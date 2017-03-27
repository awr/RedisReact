using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using ServiceStack;
using RedisReact.ServiceModel;
using ServiceStack.Configuration;
using ServiceStack.Redis;
using ServiceStack.Text.Json;

namespace RedisReact.ServiceInterface
{
    public class RedisServices : Service
    {
        public class SearchCursorResult
        {
            public int Cursor { get; set; }
            public List<SearchResult> Results { get; set; }
        }

        public IAppSettings AppSettings { get; set; }

        public object Any(SearchRedis request)
        {
            var position = request.Position.GetValueOrDefault(0); // 0 marks a new scan request
            var limit = request.Take.GetValueOrDefault(AppSettings.Get("query-limit", 100));

            const string LuaScript = @"
local limit = tonumber(ARGV[2])
local pattern = ARGV[1]
local cursor = tonumber(ARGV[3])
local len = 0
local keys = {}

repeat
    local r = redis.call('scan', cursor, 'MATCH', pattern, 'COUNT', limit)
    cursor = tonumber(r[1])
    for k,v in ipairs(r[2]) do
        table.insert(keys, v)
        len = len + 1
        if len == limit then break end
    end
until cursor == 0 or len == limit

local cursorAttrs = {['cursor'] = cursor, ['results'] = {}}
if len == 0 then
    return cursorAttrs
end

local keyAttrs = {}
for i,key in ipairs(keys) do
    local type = redis.call('type', key)['ok']
    local pttl = redis.call('pttl', key)
    local size = 0
    if type == 'string' then
        size = redis.call('strlen', key)
    elseif type == 'list' then
        size = redis.call('llen', key)
    elseif type == 'set' then
        size = redis.call('scard', key)
    elseif type == 'zset' then
        size = redis.call('zcard', key)
    elseif type == 'hash' then
        size = redis.call('hlen', key)
    end

    local attrs = {['id'] = key, ['type'] = type, ['ttl'] = pttl, ['size'] = size}

    table.insert(keyAttrs, attrs)    
end
cursorAttrs['results'] = keyAttrs

return cjson.encode(cursorAttrs)";

            var json = Redis.ExecCachedLua(LuaScript, sha1 =>
                Redis.ExecLuaShaAsString(sha1, request.Query, limit.ToString(), position.ToString()));

            var searchResults = json.FromJson<SearchCursorResult>();

            return new SearchRedisResponse
            {
                Position = searchResults.Cursor,
                Results = searchResults.Results
            };
        }

        public object Any(CallRedis request)
        {
            var args = request.Args.ToArray();
            var response = new CallRedisResponse { Result = Redis.Custom(args) };
            return response;
        }

        public object Get(GetConnections request)
        {
            var role = Redis.GetServerRole();
            var connections = new List<Connection> {
                new Connection {
                    Host = Redis.Host,
                    Port = Redis.Port,
                    Db = (int)Redis.Db,
                    IsMaster = role == RedisServerRole.Master
                }
            };

            switch (role) {
                case RedisServerRole.Master:
                    connections.AddRange(GetSlaves());
                    break;

                case RedisServerRole.Slave:
                    connections.AddRange(GetMaster());
                    break;
            }

            return new GetConnectionsResponse {
                Connections = connections
            };
        }

        private IEnumerable<Connection> GetMaster()
        {
            string host, masterPort = null;
            if (Redis.Info.TryGetValue("master_host", out host) &&
                Redis.Info.TryGetValue("master_port", out masterPort)) {
                var master = new Connection {
                    Host = host,
                    Db = (int) Redis.Db,
                    IsMaster = true
                };
                int port;
                if (int.TryParse(masterPort, out port)) {
                    master.Port = port;
                }
                yield return master;
            }
        }

        private IEnumerable<Connection> GetSlaves()
        {
            string connectedSlaves;
            if (Redis.Info.TryGetValue("connected_slaves", out connectedSlaves)) {
                int slaves;
                if (int.TryParse(connectedSlaves, out slaves)) {
                    for (var i = 0; i < slaves; i++) {
                        string slave, ip = null;
                        int port = Redis.Port;
                        if (Redis.Info.TryGetValue("slave" + i, out slave)) {
                            var parts = slave.Split(',');
                            foreach (var part in parts) {
                                if (part.StartsWith("ip=")) {
                                    ip = part.Split('=')[1];
                                } else if (part.StartsWith("port=")) {
                                    int.TryParse(part.Split('=')[1], out port);
                                }
                            }
                            if (!string.IsNullOrEmpty(ip)) {
                                yield return 
                                    new Connection {
                                        Host = ip,
                                        Db = (int) Redis.Db,
                                        IsMaster = false,
                                        Port = port
                                    };
                            }
                        }
                    }
                }
            }
        }

        private static ChangeConnection ApplyDefaults(ChangeConnection request)
        {
            return new ChangeConnection {
                Host = request.Host ?? "127.0.0.1",
                Port = request.Port.GetValueOrDefault(6379),
                Db = request.Db.GetValueOrDefault(0),
                Password = request.Password
            };
        }

        private static string GetConnectionString(ChangeConnection request, string password = null)
        {
            var connString = "{0}:{1}?db={2}".Fmt(
                request.Host,
                request.Port,
                request.Db);

            if (!string.IsNullOrEmpty(password ?? request.Password))
                connString += "&password=" + (password ?? request.Password).UrlEncode();

            return connString;
        }

        public object Post(ChangeConnection request)
        {
            var connection = ApplyDefaults(request);

            string connString;
            if (TryConnect(connection, false, false, out connString) ||
                TryConnect(connection, true, false, out connString) ||
                TryConnect(connection, true, true, out connString) ||
                TryConnect(connection, false, true, out connString)) {
                ((IRedisFailover)TryResolve<IRedisClientsManager>()).FailoverTo(connString);
            }

            return Get(new GetConnections());
        }

        private bool TryConnect(ChangeConnection connection, bool ssl, bool password, out string connString)
        {
            connString = GetConnectionString(connection, password ? Redis.Password : null);
            if (ssl) {
                connString += "&ssl=true";
            }

            try {
                var testConnection = new RedisClient(connString);
                testConnection.Ping();
                return true;
            } catch {
                return false;
            }
        }

        public object Any(GetRedisClientStats request)
        {
            return new GetRedisClientStatsResponse { Result = RedisStats.ToDictionary() };
        }

        private static string defaultHtml = null;

        public object Any(FallbackForClientRoutes request)
        {
            return defaultHtml ?? 
                (defaultHtml = HostContext.ResolveVirtualFile("/default.html", Request).ReadAllText());
        }
    }

    [FallbackRoute("/{PathInfo*}")]
    public class FallbackForClientRoutes
    {
        public string PathInfo { get; set; }
    }
}