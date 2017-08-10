using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using RedisReact.ServiceModel;
using ServiceStack;
using ServiceStack.Configuration;
using ServiceStack.Redis;
using ServiceStack.Text;

namespace RedisReact.ServiceInterface
{
    public class SharedUtils
    {
        public static IAppSettings GetAppSettings()
        {
            CreateAppSettingsIfNotExists(
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".redisreact"));

            var paths = new[]
            {
                "~/appsettings.txt".MapHostAbsolutePath(),
                "~/appsettings.txt".MapAbsolutePath(),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".redisreact", "appsettings.txt")
            };

            foreach (var path in paths)
            {
                var customSettings = new FileInfo(path);
                if (customSettings.Exists)
                    return new TextFileSettings(customSettings.FullName);
            }

            return new AppSettings();
        }

        public static void Configure(IAppHost appHost)
        {
            JsConfig.EmitCamelCaseNames = true;

            RedisConfig.AssumeServerVersion = 2821;

            var container = appHost.GetContainer();
            container.Register<IRedisClientsManager>(
                c => {
                    var db = appHost.AppSettings.Get("redis-db", 0);
                    var port = appHost.AppSettings.Get("redis-port", 6379);
                    var password = appHost.AppSettings.GetString("redis-password");
                    var ssl = appHost.AppSettings.Get("redis-ssl", false);
                    return appHost.AppSettings.Get("redis-servers", "localhost")
                                  .Split(',') // allow for multiple redis servers to be specified
                                  .Select(host => {
                                      try {
                                          var connString = GetMasterConnectionString(host, port, db, password, ssl);
                                          if (connString != null) return new RedisManagerPool(connString);
                                      } catch {
                                      }
                                      return null;
                                  })
                                  .First(pool => pool != null);
                });
        }

        public static void CreateAppSettingsIfNotExists(string redisreactDir)
        {
            if (!Directory.Exists(redisreactDir))
            {
                try
                {
                    Directory.CreateDirectory(redisreactDir);
                    var appSettingsPath = Path.Combine(redisreactDir, "appsettings.txt");
                    File.WriteAllText(appSettingsPath, "redis-server 127.0.0.1\r\nquery-limit 100");
                }
                catch { }
            }
        }

        internal static string GetMasterConnectionString(string host, int port, int db, string password, bool ssl)
        {
            var connString = "{0}:{1}?db={2}".Fmt(
                host,
                port,
                db);

            if (!string.IsNullOrEmpty(password)) connString += "&password=" + password.UrlEncode();
            if (ssl) connString += "&ssl=true";

            try {
                var testConnection = new RedisClient(connString);
                testConnection.Ping();

                if (testConnection.GetServerRole() == RedisServerRole.Master) return connString;

                var master = GetMaster(testConnection).SingleOrDefault();
                if (master != null) return GetMasterConnectionString(master.Host, master.Port, master.Db, password, ssl);
            } catch (Exception ex) {
                Console.WriteLine(ex + " host: " + host);
            }
            return null;
        }

        internal static IEnumerable<Connection> GetMaster(IRedisClient client)
        {
            string host, masterPort = null;
            if (client.Info.TryGetValue("master_host", out host) &&
                client.Info.TryGetValue("master_port", out masterPort)) {
                var master = new Connection {
                    Host = host,
                    Db = (int)client.Db,
                    IsMaster = true
                };
                int port;
                if (int.TryParse(masterPort, out port)) {
                    master.Port = port;
                }
                yield return master;
            }
        }
    }
}
