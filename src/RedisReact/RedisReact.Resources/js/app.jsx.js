var Dashboard = React.createClass({displayName: "Dashboard",
    mixins: [
        Reflux.listenTo(InfoStore, "onInfoResults")
    ],
    getInitialState: function () {
        return { info: InfoStore.info };
    },
    onInfoResults: function (info) {
        this.setState({ info: info });
    },
    render: function () {
        var Info = React.createElement("div", null);

        var info = this.state.info;
        if (info) {
            Info = (
                React.createElement("table", {className: "table table-striped table-wrap"}, 
                    
                        [].concat.apply(Object.keys(info).map(function(group){
                            var to = [React.createElement("tr", null, React.createElement("th", {colSpan: "2"}, group))];
                            var infoGroup = info[group];
                            Object.keys(infoGroup).forEach(function(k){
                                to.push(React.createElement("tr", null, React.createElement("td", null, k), React.createElement("td", null, infoGroup[k])))
                        });
                            return to;
                        }))
                        
                )
            );
        }

        return (
          React.createElement("div", {id: "dashboard-page"}, 
              React.createElement("div", {className: "content"}, 
                  Info
              )
          )
        );
    }
});

var KeyView = React.createClass({displayName: "KeyView",
    mixins: [
        Router.Navigation,
        Router.State
    ],
    removeExpiry: function () {
        Actions.setConsole(`PERSIST ${this.props.result.id}`);
    },
    renderValue: function (s) {
        if (typeof s == 'undefined')
            s = '';
        if (!isJsonObject(s)) {
            if (typeof s == 'string' && s.startsWith('"') && s.endsWith('"'))
                s = s.substring(1, s.length -1);

            return React.createElement("div", null, s);
        }

        if (this.props.rawMode)
            return React.createElement("div", {className: "rawview"}, s);

        try {
            var o = JSON.parse(s);
            var el = React.createElement("div", {className: "jsonviewer", 
                          dangerouslySetInnerHTML: {__html: jsonviewer(o)}});
            return el;
        } catch (e) {
            return React.createElement("div", null, s);
        }
    },
    edit: function (f, value) {
        var result = this.props.result;
        switch (result.type) {
            case 'list':
                Actions.setConsole(`LSET ${result.id} ${f} ${value}`);
                break;
            case 'set':
                Actions.setConsole(`SREM ${result.id} ${value}`);
                break;
            case 'zset':
                Actions.setConsole(`ZREM ${result.id} ${value}`);
                break;
            case 'hash':
                Actions.setConsole(`HSET ${result.id} ${f} ${value}`);
                break;
            default:
                Actions.setConsole(`SET ${result.id} ${result.value}`);
                break;
        }
    },
    delValue: function(f, value) {
        var result = this.props.result;
        switch (result.type) {
            case 'list':
                Actions.setConsole(`LREM ${result.id} 1 ${value}`);
                break;
            case 'set':
                Actions.setConsole(`SREM ${result.id} ${value}`);
                break;
            case 'zset':
                Actions.setConsole(`ZREM ${result.id} ${value}`);
                break;
            case 'hash':
                Actions.setConsole(`HDEL ${result.id} ${f}`);
                break;
        }
    },
    renderString: function (value) {
        var $this = this;
        return (
            React.createElement("div", {className: "key-preview key-string wrap", onDoubleClick: $this.edit}, 
                React.createElement("table", {className: "table table-striped wrap"}, 
                    React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", null, this.renderValue(value))))
                )
            )
        );
    },
    renderList: function (items) {
        var $this = this;
        var i = 0;
        return (
            React.createElement("table", {className: "table table-striped wrap"}, 
            React.createElement("tbody", null, 
                items.map(function (x) {
                    let index = i++;
                    return (
                        React.createElement("tr", {key: index, onDoubleClick: () => $this.edit(index, x)}, React.createElement("td", null, $this.renderValue(x)), React.createElement("td", {className: "action", onClick: () => $this.delValue(index, x)}, React.createElement("span", {className: "octicon octicon-x"})))
                    );
                })
            )
            )
        );
    },
    renderMap: function (values, type) {
        var $this = this;
        var Head = null;
        if (type == 'hash') {
            Head = React.createElement("thead", null, React.createElement("tr", null, React.createElement("td", null, "Field"), React.createElement("td", null, "Value"), React.createElement("td", null)));
        }
        return (
            React.createElement("table", {className: "table table-striped wrap"}, 
            Head, 
            React.createElement("tbody", null, 
                Object.keys(values).map(function(k){
                    return (
                        React.createElement("tr", {key: k, onDoubleClick: () => $this.edit(k, values[k])}, React.createElement("td", null, $this.renderValue(k)), React.createElement("td", null, $this.renderValue(values[k])), React.createElement("td", {className: "action", onClick: () => $this.delValue(k, values[k])}, React.createElement("span", {className: "octicon octicon-x"})))
                    );
                })
            )
            )
        );
    },
    render: function () {
        var View = React.createElement("div", {className: "keyview-none"}, "Key does not exist");

        var result = this.props.result;
        if (!result) 
            return View;

        if (result.type == 'string')
            View = this.renderString(result.value);
        else if (result.type == 'list')
            View = this.renderList(result.value);
        else if (result.type == 'set')
            View = this.renderList(result.value);
        else if (result.type == 'zset')
            View = this.renderMap(result.value, result.type);
        else if (result.type == 'hash')
            View = this.renderMap(result.value, result.type);

        var Title = React.createElement("b", null, React.createElement(Link, {to: "keys", query: {id:result.id, type:result.type}}, result.id));
        if (this.props.isPrimary) {
            var key = result.id;
            var Links = [];

            var lastPos = 0;
            for (var i = 0; i < key.length; i++) {
                var c = key[i];
                if (SEPARATORS.indexOf(c) != -1) {
                    var pattern = key.substring(0,i+1) + '*';
                    Links.push(React.createElement(Link, {key: pattern, to: "search", query: {q: pattern}}, key.substring(lastPos, i)));
                    Links.push(React.createElement("em", {key: i}, key.substring(i, i + 1)));
                    lastPos = i + 1;
                }
            }

            Links.push(React.createElement("b", {key: lastPos}, key.substring(lastPos)));

            Title = React.createElement("b", {className: "keycrumbs"}, Links);
        }
        var Expiry = null;
        if (result.ttl && result.ttl > 0) {
            Expiry = (
                React.createElement("div", {className: "action", onClick: this.removeExpiry}, 
                    React.createElement("span", {className: "octicon octicon-watch"}), 
                    React.createElement("b", null, Math.round(result.ttl / 1000) + 's')
                )
            );
        }
        return (
            React.createElement("div", {className: "keyview"}, 
                React.createElement("h3", null, 
                  React.createElement("span", {className: "octicon octicon-key"}), 
                  React.createElement("i", null, result.type), 
                  Title
                ), 
                Expiry, 
                React.createElement("div", {onClick: this.props.toggleRawMode, title: "use 't' shortcut key"}, 
                    View
                )
            )
        );
    }
});
var KeyViewer = React.createClass({displayName: "KeyViewer",
    mixins: [
        DebugLogMixin,
        Router.Navigation,
        Router.State,
        Reflux.listenTo(SettingsStore, "onSettingsUpdated"),
        Reflux.listenTo(KeyStore, "onKeyLoaded")
    ],
    componentWillMount: function () {
        this.setState({ appRawMode: SettingsStore.appRawMode, rawModes: {}, relatedKeys: [] });
        var q = this.getQuery();
        Actions.loadKey(q.id, q.type);
        document.addEventListener('keyup', this.globalKeyUp);
    },
    componentWillUnmount: function () {
        document.removeEventListener('keyup', this.globalKeyUp);
    },
    componentWillReceiveProps: function () {
        var q = this.getQuery();
        Actions.loadKey(q.id, q.type);
    },
    onSettingsUpdated: function (settings) {
        this.setState({ appRawMode: settings.appRawMode, rawModes: {} });
    },
    onKeyLoaded: function (result) {
        this.setState({ result: result });
    },
    navToKey: function (e) {
        var tr = $(e.target).parents("tr");
        this.viewKey(tr.data("id"), tr.data("type"));
    },
    viewKey: function(id, type){
        var args = { id: id, type: type };
        this.transitionTo("keys", null, args);
    },
    console: function () {
        switch (this.state.result.type) {
            case 'list':
                Actions.setConsole(`LRANGE ${this.state.result.id} 0 -1`);
                break;
            case 'set':
                Actions.setConsole(`SMEMBERS ${this.state.result.id}`);
                break;
            case 'zset':
                Actions.setConsole(`ZRANGE ${this.state.result.id} 0 -1 WITHSCORES`);
                break;
            case 'hash':
                Actions.setConsole(`HGETALL ${this.state.result.id}`);
                break;
            default:
                Actions.setConsole(`GET ${this.state.result.id}`);
                break;
        }
    },
    edit: function () {
        Actions.setConsole('SET ' + this.state.result.id + ' ' + this.state.result.value);
    },
    setExpiry: function () {
        var result = this.state.result;
        Actions.setConsole(`PEXPIRE ${result.id} ${result.ttl != null ? result.ttl : ""}`);
    },
    del: function () {
        Actions.setConsole('DEL ' + this.state.result.id);
    },
    add: function () {
        switch (this.state.result.type) {
            case 'list':
                Actions.setConsole(`LPUSH ${this.state.result.id} ?`);
                break;
            case 'set':
                Actions.setConsole(`SADD ${this.state.result.id} ?`);
                break;
            case 'zset':
                Actions.setConsole(`ZADD ${this.state.result.id} ${this.state.result.length} ?`);
                break;
            case 'hash':
                Actions.setConsole(`HSET ${this.state.result.id} [field] ?`);
                break;
        }
    },
    delAll: function () {
        var cmd = 'DEL ' + this.state.result.id;

        var relatedKeys = this.state.result.relatedKeys || {};
        Object.keys(relatedKeys).forEach(function (id) {
            if (!relatedKeys[id]) return;
            cmd += ' ' + id;
        });

        Actions.setConsole(cmd);
    },
    toggleRawMode: function (pos, e) {
        if (hasTextSelected())
            return;

        if (this.state.rawModes[pos] && (e.shiftKey || e.ctrlKey)) {
            selectText(e.target);
            return;
        }

        this.state.rawModes[pos] = !this.state.rawModes[pos];
        this.setState({ rawModes: this.state.rawModes });
    },
    globalKeyUp: function (e) {
        var shortcutKeys = [Keys.LEFT, Keys.RIGHT];
        if (e.altKey || e.ctrlKey || shortcutKeys.indexOf(e.which) == -1)
            return;

        var nextKeyPos = e.which == Keys.LEFT
            ? -1
            : 1;

        var id = this.getQuery().id;
        var similarKeys = this.state.result.similarKeys || [];
        for (var i = 0; i < similarKeys.length; i++) {
            var key = similarKeys[i];
            if (key.id == id) {
                var nextKey = similarKeys[i + nextKeyPos];
                if (nextKey) {
                    this.viewKey(nextKey.id, nextKey.type);
                }
                return;
            }
        }
    },
    render: function () {
        var $this = this;
        var View = React.createElement("div", null, "Key does not exist");
        var SimilarKeys = React.createElement("div", null);

        var result = this.state.result;
        if (result && result.similarKeys) {
            SimilarKeys = (
                React.createElement("table", {className: "table"}, 
                React.createElement("tbody", null, 
                React.createElement("tr", null, 
                    React.createElement("th", null, result.query)
                ), 
                    result.similarKeys.map(function(r){
                        var activeClass = r.id == result.id ? 'active ' : '';
                        var activeIcon = activeClass
                            ? React.createElement("b", {className: "octicon octicon-chevron-right"})
                            : React.createElement("b", null);

                        return (
                            React.createElement("tr", {key: r.id, className: activeClass, onClick: $this.navToKey, "data-id": r.id, "data-type": r.type}, 
                                React.createElement("td", null, 
                                    activeIcon, 
                                    r.id
                                )
                            )
                        );
                    })
                )
                )
            );
        }

        var relatedKeys = result && result.relatedKeys || {};
        var id = this.getQuery().id;
        var rawModes = this.state.rawModes;
        var i = 0;

        var Edit = null;
        if (result && result.type == 'string') {
            Edit = (React.createElement("div", {className: "action", onClick: this.edit}, 
                        React.createElement("span", {className: "octicon octicon-pencil"}), React.createElement("b", null, "edit")
                    ));
        }
        var Add = null;
        if (result && (result.type == 'list' || result.type == 'set' || result.type == 'zset' || result.type == 'hash')) {
            Add = (React.createElement("div", {className: "action", onClick: this.add}, 
                    React.createElement("span", {className: "octicon octicon-plus"}), React.createElement("b", null, "add")
            ));
        }
        var DeleteAll = null;
        if (Object.keys(relatedKeys).length > 0) {
            DeleteAll = (React.createElement("div", {className: "action", onClick: this.delAll}, 
                    React.createElement("span", {className: "octicon octicon-x"}), React.createElement("b", null, "all")
            ));
        }

        return (
          React.createElement("div", {id: "keyviewer-page"}, 
            React.createElement("div", {className: "actions"}, 
                React.createElement("div", {className: "action", onClick: this.console}, 
                    React.createElement("span", {className: "octicon octicon-terminal"}), 
                    React.createElement("b", null, "console")
                ), 
                React.createElement("div", {className: "action", onClick: this.setExpiry}, 
                    React.createElement("span", {className: "octicon octicon-watch"}), 
                    React.createElement("b", null, "set expiry")
                ), 
                Edit, 
                Add, 
                React.createElement("div", {className: "action", onClick: this.del}, 
                    React.createElement("span", {className: "octicon octicon-x"}), 
                    React.createElement("b", null, "delete")
                ), 
                DeleteAll
            ), 
              React.createElement("div", {className: "content"}, 
                React.createElement("div", {id: "similarkeys", title: "use left/right arrow keys"}, 
                    SimilarKeys
                ), 
                React.createElement("div", {id: "keyview"}, 
                    React.createElement(KeyView, {key: id, result: result, rawMode: this.state.appRawMode ? !rawModes[i] : rawModes[i], toggleRawMode: this.toggleRawMode.bind(this, i), isPrimary: true}), 
                    Object.keys(relatedKeys).map(function(id){
                        if (!relatedKeys[id]) return;
                        i++;
                        var result = {id: id, value:relatedKeys[id], type:'string'};
                        return (
                            React.createElement(KeyView, {key: id, result: result, rawMode: $this.state.appRawMode ? !rawModes[i] : rawModes[i], toggleRawMode: $this.toggleRawMode.bind($this, i)})
                        );
                    })
                )
              )
          )
        );
    }
});
var Search = React.createClass({displayName: "Search",
    mixins: [
        DebugLogMixin,
        Router.Navigation,
        Router.State,
        Reflux.listenTo(SearchStore, "onSearchResults")
    ],
    getInitialState: function () {
        return { position: -1, query:SearchStore.query, results: SearchStore.results, viewGrid: false, gridResults:[] };
    },
    componentWillMount: function () {
        var q = this.getQuery().q;
        Actions.search(q);
    },
    componentWillReceiveProps: function () {
        var q = this.getQuery().q;
        Actions.search(q);
    },
    componentDidMount() {
        this.attachScrollListener();
    },
    componentDidUpdate() {
        this.attachScrollListener();
    },
    componentWillUnmount() {
        this.detachScrollListener();
    },
    attachScrollListener() {
        if(this.state.position == 0) {
            return;
        }

        let scrollEl = window;
        scrollEl.addEventListener('scroll', this.scrollListener, this.props.useCapture);
        scrollEl.addEventListener('resize', this.scrollListener, this.props.useCapture);
    },
    detachScrollListener() {
        let scrollEl = window;
        scrollEl.removeEventListener('scroll', this.scrollListener, this.props.useCapture);
        scrollEl.removeEventListener('resize', this.scrollListener, this.props.useCapture);
    },
    calculateTopPosition(el) {
        if(!el) {
            return 0;
        }
        return el.offsetTop + this.calculateTopPosition(el.offsetParent);
    },
    scrollListener() {
        const el = this.scrollComponent.getDOMNode();
        const scrollEl = window;

        var scrollTop = (scrollEl.pageYOffset !== undefined) ? scrollEl.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
        let offset = this.calculateTopPosition(el) + el.offsetHeight - scrollTop - window.innerHeight;

        if(offset < 250) {
            this.detachScrollListener();
            // Call loadMore after detachScrollListener to allow for non-async loadMore functions
            this.onLoadMore();
        }
    },
    onSearchResults: function (search) {
        this.setState({ position: search.position, query: search.query, results: search.results, viewGrid: false, gridResults: [] });
    },
    onLoadMore: function() {
        var q = this.getQuery().q;
        if (this.state.position != 0) {
            Actions.search(q, this.state.position);
        }
    },
    onKeyClick: function (e) {
        var tr = $(e.target).parent("tr");
        var key = tr.data("id");
        SearchStore.search(key);
        this.transitionTo("keys", null, { id: key, type: tr.data("type") });
    },
    toggleGridView: function (e) {
        var viewGrid = !this.state.viewGrid;

        var keys = this.state.results.map(function (r) {
            return r.id;
        });
        var $this = this;
        Redis.getStringValues(keys)
            .then(function (r) {
                var to = [];
                Object.keys(r).forEach(function (k) {
                    try {
                        var o = JSON.parse(r[k]);
                        o.__id = k;
                        to.push(o);
                    } catch (e) { }
                });

                $this.setState({ viewGrid:viewGrid, gridResults: to })
            });

    },
    render: function () {
        var SearchResults;
        var $this = this;
        if (this.state.results.length > 0) {
            var ViewGrid = null;

            var onlyStrings = this.state.results.every(function (r) {
                return r.type == 'string';
            });
            if (SearchStore.query.length > 3 && onlyStrings) {
                var ViewGrid = (
                    React.createElement("caption", {className: "actions"}, 
                        React.createElement("div", {className: "viewgrid", onClick: this.toggleGridView}, 
                            React.createElement("span", {className: "octicon octicon-list-unordered"}), 
                            React.createElement("b", null, this.state.viewGrid ? 'view summary' : 'view as grid')
                        )
                    ));
            }

            var gridResults = this.state.gridResults || [];
            if (this.state.viewGrid && gridResults.length > 0) {
                var headers = Object.keys(gridResults[0]).filter(function (k) {
                    return !k.startsWith("__");
                });
                
                var vIndex = 0;
                SearchResults = (
                    React.createElement("table", {className: "table table-striped table-wrap search-results"}, 
                      ViewGrid, 
                      React.createElement("thead", null, 
                          React.createElement("tr", null, 
                              headers.map(function(k) {
                                  return React.createElement("th", {key: k}, k);
                              })
                          )
                      ), 
                      React.createElement("tbody", null, 
                          gridResults.map(function(o) {
                              return (
                                  React.createElement("tr", {key: o.__id, onClick: $this.onKeyClick, "data-id": o.__id, "data-type": "string"}, 
                                      headers.map(function(k) {
                                      var v = o[k];
                                      return React.createElement("td", {key: vIndex++}, valueFmt(v));
                                  })
                                  )
                              );
                          })
                      )
                    ));
            } else {
                SearchResults = (
                    React.createElement("table", {className: "table table-striped table-wrap search-results"}, 
                      ViewGrid, 
                      React.createElement("thead", null, 
                          React.createElement("tr", null, 
                              React.createElement("th", null, "Key"), 
                              React.createElement("th", null, "Type"), 
                              React.createElement("th", null, "Size"), 
                              React.createElement("th", null, "Expires")
                          )
                      ), 
                      React.createElement("tbody", null, 
                          this.state.results.map(function(r) {
                              return (
                                  React.createElement("tr", {key: r.id, onClick: $this.onKeyClick, "data-id": r.id, "data-type": r.type}, 
                                      React.createElement("td", null, r.id), 
                                      React.createElement("td", null, r.type), 
                                      React.createElement("td", null, r.size +
                                          (r.type == 'string' ? ' byte' : ' element') +
                                          (r.size > 1 ? 's' : '') ), 
                                      React.createElement("td", null, r.ttl == -1 ? 'never' : Math.round(r.ttl / 1000) + 's')
                                  )
                              );
                          })
                      )
                    ));
            }

        } else if ($("#txtSearch").val()) {
            SearchResults = React.createElement("div", null, "Sorry No Results :(")
        }

        return (
          React.createElement("div", {id: "search-page"}, 
              React.createElement("div", {className: "content", ref: (input) => { $this.scrollComponent = input; }}, 
                  SearchResults
              )
          )
        );
    }
});

var Connections = React.createClass({displayName: "Connections",
    mixins: [
        Reflux.listenTo(ConnectionStore, "onConnection")
    ],
    getInitialState: function () {
        return { connections: ConnectionStore.connections, connection: null, successMessage: null };
    },
    onConnection: function () {
        this.setState({ connections: ConnectionStore.connections, connection: ConnectionStore.connections[0] });
    },
    selectText: function (e) {
        var target = e.target;
        setTimeout(function () {
            target.select();
        }, 0);
    },
    onChange: function(e) {
        var conn = this.state.connection || {};
        conn[e.target.name] = e.target.value;
        this.setState({ connection: conn });
    },
    onClear: function(e) {
        e.preventDefault();
        this.setState({ connection: null });
    },
    onSubmit: function(e) {
        e.preventDefault();

        this.setState({ successMessage: null });

        var $this = this;
        $(e.target).ajaxSubmit({
            onSubmitDisable: $("#btnSave"),
            success: function() {
                $this.setState({ successMessage: "Connections updated" });
                Actions.loadConnections();
            }
        });
    },
    onConnect: function (e, conn) {
        e.preventDefault();

        var $this = this;
        Redis.setConnection(conn)
            .then(function (r) {
                $this.setState({ successMessage: "Connected to " + conn.host + ":" + conn.port, connections: r.connections });
            });
    },
    onUpdate: function (e, conn) {
        e.preventDefault();
        this.setState({ connection: conn });
    },
    render: function () {
        const conn = this.state.connection;
        var $this = this;

        var ExistingConnections = {};
        if (this.state.connections !== null) {
            ExistingConnections = (
                    React.createElement("table", {className: "table table-striped wrap"}, 
                        React.createElement("thead", null, 
                            React.createElement("tr", null, 
                                React.createElement("td", null), 
                                React.createElement("td", null, "Host"), 
                                React.createElement("td", null, "Port"), 
                                React.createElement("td", null, "Db"), 
                                React.createElement("td", null, "Role"), 
                                React.createElement("td", null, "Actions")
                            )
                        ), 
                        React.createElement("tbody", null, 
                            this.state.connections.map(function (conn) {
                            var Status = null;
                            var Buttons = [];
                            const onUpdate = (e) => {
                                $this.onUpdate(e, conn);
                            };
                            Buttons.push(React.createElement("button", {className: "btn btn-default btn-primary octicon octicon-gear", onClick: onUpdate}));
                            if (conn != ($this.state.connection || ConnectionStore.activeConnection)) {
                                Status = React.createElement("label", {className: "octicon octicon-radio-tower"});
                                const onConnect = (e) => {
                                    $this.onConnect(e, conn);
                                };
                                Buttons.push(React.createElement("button", {className: "btn btn-default btn-success octicon octicon-radio-tower", onClick: onConnect}));
                            } else {
                                Status = React.createElement("label", {className: "octicon octicon-radio-tower", style: { color: "#2cbe4e"}});
                            }
                            return (
                                    React.createElement("tr", {key: conn.host + ":" + conn.port}, 
                                        React.createElement("td", null, Status), 
                                        React.createElement("td", null, conn.host), 
                                        React.createElement("td", null, conn.port), 
                                        React.createElement("td", null, conn.db), 
                                        React.createElement("td", null, conn.isMaster ? "master" : ""), 
                                        React.createElement("td", {className: "actions"}, Buttons)
                                    )
                            );
                        })
                    )
                )
            );
        }

        return (
          React.createElement("div", {id: "connections-page"}, 
            React.createElement("div", {className: "content"}, 
                React.createElement("h2", null, "Redis Connections"), ExistingConnections, 
                React.createElement("form", {id: "formConnection", className: "form-inline", onSubmit: this.onSubmit, action: "/connection"}, 
                    React.createElement("div", {className: "form-group"}, 
                        React.createElement("label", {className: "octicon octicon-radio-tower"}), 
                        React.createElement("input", {ref: "txtHost", id: "txtHost", name: "host", type: "text", className: "form-control", placeholder: "127.0.0.1", spellCheck: "false", 
                               onChange: this.onChange, onFocus: this.selectText, 
                               value: conn ? conn.host : ""}), 
                        React.createElement("label", null, ":"), 
                        React.createElement("input", {id: "txtPort", name: "port", type: "text", className: "form-control", placeholder: "6379", spellCheck: "false", 
                               onChange: this.onChange, onFocus: this.selectText, 
                               value: conn ? conn.port : ""}), 
                        React.createElement("label", null, "db"), 
                        React.createElement("input", {id: "txtDb", name: "db", type: "text", className: "form-control", placeholder: "0", spellCheck: "false", 
                               onChange: this.onChange, onFocus: this.selectText, 
                               value: conn ? conn.db : ""}), 
                        React.createElement("label", null, "auth"), 
                        React.createElement("input", {id: "txtPassword", name: "password", type: "password", className: "form-control", placeholder: "password", spellCheck: "false", 
                               onChange: this.onChange, onFocus: this.selectText, 
                               value: conn ? conn.password : ""})
                    ), 
                    React.createElement("p", {className: "actions"}, 
                        React.createElement("img", {className: "loader", src: "/img/ajax-loader.gif"}), 
                        React.createElement("button", {id: "btnSave", className: "btn btn-default btn-primary"}, conn != null ? "Save" : "Add"), 
                        React.createElement("button", {id: "btnCancel", className: "btn btn-default", onClick: this.onClear}, "Cancel")
                    ), 
                    React.createElement("p", {className: "bg-success"}, this.state.successMessage), 
                    React.createElement("p", {className: "bg-danger error-summary"})
                )
            )
          )
        );
    }
});


var Console = React.createClass({displayName: "Console",
    mixins: [
        Router.Navigation,
        Router.State,
        Reflux.listenTo(SettingsStore, "onSettingsUpdated"),
        Reflux.listenTo(ConsoleStore, "onConsoleChanged")
    ],
    getInitialState: function(){
        return {
            show: false,
            expand: false,
            command: ConsoleStore.command,
            history: ConsoleStore.history,
            historyIndex: ConsoleStore.historyIndex,
            logs: ConsoleStore.logs,
            appRawMode: SettingsStore.appRawMode,
            rawModes: {}
        };
    },
    componentWillMount: function () {
        var q = this.getQuery();
        this.setState({ expand: q.expand == "true" });
    },
    onSettingsUpdated: function (settings) {
        this.setState({ appRawMode: settings.appRawMode, rawModes: {} });
    },
    onConsoleChanged: function (store) {
        var txtPrompt = this.getTextInput();
        this.setState(store, function () {
            txtPrompt.focus();
        });
    },
    setCommand: function (cmd, e) {
        var txtPrompt = this.getTextInput();
        this.setState({ command: cmd }, function () {
            txtPrompt.focus();
        });
    },
    clearLogs: function(){
        Actions.clearLogs();
        this.refs.txtPrompt.getDOMNode().focus();
    },
    getTextInput: function(){
        var txt = !this.state.expand
            ? this.refs.txtPrompt
            : this.refs.txtExpandedPrompt;
        return txt.getDOMNode();
    },
    toggleExpand: function(e){
        var $this = this;
        this.setState({ expand: !this.state.expand }, function () {
            $this.getTextInput().focus();
        });
    },
    toggleHistory: function (e) {
        this.setState({ show: !this.state.show });
    },
    toggleRawMode: function (id, e) {
        if (hasTextSelected())
            return;

        if (this.state.rawModes[id] && (e.shiftKey || e.ctrlKey)) {
            selectText(e.target);
            return;
        }

        this.state.rawModes[id] = !this.state.rawModes[id];
        this.setState({ rawModes: this.state.rawModes });
    },
    renderResponse: function (r, rawMode) {
        if (typeof r == 'string')
            return (React.createElement("div", {className: "string"}, this.renderValue(r, rawMode)));
        
        if (r.length) {
            var $this = this;
            var list = [];
            for (var i=0; i < r.length; i++){
                list.push(React.createElement("div", {key: i, className: "item"}, $this.renderValue(r[i], rawMode)));
            }
            return (React.createElement("div", {className: "list"}, list));
        }
    },
    renderValue: function (s, rawMode) {
        if (typeof s == 'undefined')
            s = '';

        if (!isJsonObject(s))
            return React.createElement("div", null, s);

        if (rawMode)
            return React.createElement("div", {className: "rawview"}, s);

        try {
            var o = JSON.parse(s);
            var el = React.createElement("div", {className: "jsonviewer", 
                          dangerouslySetInnerHTML: {__html: jsonviewer(o)}});
            return el;
        } catch (e) {
            return React.createElement("div", null, s);
        }
    },
    onSubmit: function (e) {
        e.preventDefault();

        var cmd = this.state.command;
        if (!cmd)
            return;

        Actions.addToHistory(cmd);

        var $this = this;
        Redis.execCommandString(cmd)
            .then(function (r) {
                var result = JSON.stringify(r);
                var type = r === 'OK' ? 'ok' : r ? 'msg' : 'empty';
                Actions.logEntry({
                    cmd: cmd,
                    result: r || "(empty)",
                    type: type
                });
            })
            .fail(function (jq, jqStatus, statusDesc) {
                var status = $.ss.parseResponseStatus(jq.responseText, statusDesc);
                Actions.logEntry({
                    cmd: cmd,
                    result: status.message,
                    stackTrace: status.stackTrace,
                    type: 'err',
                });
            });
        ;
    },
    onKeyDown: function(e){
        var keycode = e.which;
        var shortcutKeys = [Keys.UP, Keys.DOWN];
        if (e.altKey || e.ctrlKey || shortcutKeys.indexOf(keycode) == -1)
            return;

        if (keycode == Keys.UP) {
            Actions.nextHistory(-1);
            e.preventDefault();
        }
        else if (keycode == Keys.DOWN) {
            Actions.nextHistory(1);
        }
    },
    onChange: function(e){
        this.setState({ command: e.target.value });
    },
    render: function () {
        var $this = this;
        var logs = this.state.logs;
        var ToggleLogs = null;

        if (logs.length > 0) {
            if (this.state.show) {
                ToggleLogs = (
                    React.createElement("div", {id: "btnToggleHistory", onClick: this.toggleHistory}, 
                        React.createElement("span", {className: "octicon octicon-screen-normal"}), 
                        React.createElement("b", null, "hide history")
                    ));
            } else {
                ToggleLogs = (
                    React.createElement("div", {id: "btnToggleHistory", onClick: this.toggleHistory}, 
                        React.createElement("span", {className: "octicon octicon-screen-full"}), 
                        React.createElement("b", null, "show history")
                    ));
            }
        }

        var Prompt, ExpandedPrompt = null;
        if (this.state.expand) {
            ExpandedPrompt = (
                React.createElement("div", {id: "expandedPrompt"}, 
                    React.createElement("div", {className: "collapse-console", title: "collapse"}, 
                        React.createElement("span", {className: "octicon octicon-screen-normal", onClick: this.toggleExpand})
                    ), 
                    React.createElement("textarea", {ref: "txtExpandedPrompt", id: "txtExpandedPrompt", 
                        spellCheck: "false", autoComplete: "off", 
                        onChange: this.onChange, 
                        onKeyDown: this.onKeyDown, 
                        value: this.state.command
                        })
                ));
        } else {
            Prompt = (
                React.createElement("div", {id: "prompt"}, 
                    React.createElement("div", {className: "expand-console", title: "expand"}, 
                        React.createElement("span", {className: "octicon octicon-screen-full", onClick: this.toggleExpand})
                    ), 
                    React.createElement("div", {id: "label"}, 
                        React.createElement("span", {className: "octicon octicon-chevron-right"})
                    ), 
                    React.createElement("input", {ref: "txtPrompt", id: "txtPrompt", type: "text", className: "input-lg", 
                        placeholder: "Redis Commands e.g: GET key", 
                        spellCheck: "false", autoComplete: "off", 
                        onChange: this.onChange, 
                        onKeyDown: this.onKeyDown, 
                        value: this.state.command}
                       )
                ));
        }

        var Logs = [];
        if (this.state.show) {
            Logs = logs.map(function(log) {
                var cls = "entry";
                if (log.type)
                    cls += " " + log.type;

                var rawMode = $this.state.appRawMode ? !$this.state.rawModes[log.id] : $this.state.rawModes[log.id];
                return (
                    React.createElement("div", {key: log.id, className: cls}, 
                        React.createElement("div", {className: "cmd", onClick: $this.setCommand.bind($this, log.cmd)}, 
                            log.cmd
                        ), 
                        React.createElement("div", {className: "result", onClick: $this.toggleRawMode.bind($this, log.id)}, 
                            $this.renderResponse(log.result, rawMode), 
                            React.createElement("div", {className: "clear"})
                        )
                    )
                );
            });
            if (logs.length > 0) {
                Logs.push(
                    React.createElement("div", {className: "actions"}, 
                        React.createElement("div", {id: "btnClearHistory", onClick: this.clearLogs}, 
                            React.createElement("span", {className: "octicon octicon-x"}), 
                            React.createElement("b", null, "clear history")
                        )
                    ));
            }
        }

        return (
          React.createElement("div", {id: "console-page"}, 
            React.createElement("div", {id: "console", className: "content"}, 
                React.createElement("div", {id: "log"}, 
                    Logs
                ), 
                React.createElement("div", {className: "actions"}, 
                    ToggleLogs
                ), 
                React.createElement("form", {id: "formConsole", onSubmit: this.onSubmit}, 
                    Prompt
                )
            ), 
            ExpandedPrompt
          )
        );
    }
});


var App = React.createClass({displayName: "App",
    mixins: [
        DebugLogMixin,
        Router.Navigation,
        Router.State,
        Reflux.listenTo(SearchStore, "onSearchUpdated"),
        Reflux.listenTo(ConnectionStore, "onConnection"),
        Reflux.listenTo(ConsoleStore, "onConsole")
    ],
    getInitialState: function() {
        return { connection: null, query: this.getQuery().q };
    },
    onConnection: function (connection) {
        this.setState({ connection: connection });
    },
    onSearchUpdated: function(search){
        if (search.text != this.state.query) {
            this.setState({ query: search.text });
        }
    },
    onSearchFocus: function (e) {
        this.transitionTo('search', null, { q: e.target.value });
    },
    onSearchKeyUp: function (e) {
        if (e.target.value != this.state.query) {
            this.setState({ query: e.target.value });
            this.replaceWith("search", null, { q: e.target.value });
        }
    },
    clearSearch: function(e){
        this.refs.txtSearch.getDOMNode().focus();
        this.replaceWith("search", null, { q: null });
    },
    render: function () {
        var Connection = React.createElement("b", null, "not connected");
        var conn = this.state.connection;
        if (conn != null) {
            Connection = React.createElement("b", null, conn.host, ":", conn.port, " db=", conn.db, " ", !conn.isMaster ? 'slave' : 'master');
        }

        var ClearSearch = null;
        if (this.state.query) {
            ClearSearch = (React.createElement("div", {className: "clear-search"}, 
                React.createElement("span", {className: "octicon octicon-x", onClick: this.clearSearch, title: "clear search"})
            ));
        }

        return (
            React.createElement("div", null, 
                React.createElement("nav", {className: "navbar navbar-default navbar-fixed-top"}, 
                    React.createElement("div", {className: "container-fluid"}, 
                        React.createElement("div", {className: "navbar-header"}, 
                            React.createElement(Link, {to: "app", title: "Home", className: "navbar-brand"}, 
                                React.createElement("img", {id: "redislogo", alt: "Brand", src: "/img/redis-logo.png"})
                            ), 
                            React.createElement("h1", null, "Redis React"), 
                            React.createElement(Link, {id: "connection", to: "connections", title: "Connections"}, 
                                React.createElement("span", {className: "octicon octicon-radio-tower"}), 
                                Connection
                            )
                        ), 
                        React.createElement("form", {id: "formSearch", className: "navbar-form navbar-left", role: "search"}, 
                            React.createElement("div", null, 
                                ClearSearch, 
                                React.createElement("span", {className: "octicon octicon-search"}), 
                                React.createElement("input", {ref: "txtSearch", id: "txtSearch", type: "text", className: "input-lg", 
                                       placeholder: "Search Keys", 
                                       spellCheck: "false", autoComplete: "off", 
                                       onFocus: this.onSearchFocus, 
                                       onChange: this.onSearchKeyUp, 
                                       value: this.state.query})
                            )
                        ), 
                        React.createElement("div", {className: "nav navbar-nav navbar-right"}, 
                            React.createElement("a", {href: "https://servicestack.net", title: "servicestack.net", target: "_blank"}, 
                                React.createElement("img", {id: "logo", alt: "Brand", src: "/img/logo-32.png"})
                            )
                        )
                    )
                ), 
                React.createElement("div", null, 
                    
                    //<div id="sidebar">
                    //    <ul id="menu">
                    //        <li className="list-group-item">
                    //        </li>
                    //    </ul>
                    //</div>
                    
                    React.createElement("div", {id: "body"}, 
                        /* this is the important part */
                        React.createElement(RouteHandler, null)
                    ), 
                    React.createElement(Console, null)
                ), 
                React.createElement("div", {id: "poweredby"}, React.createElement("a", {href: "https://servicestack.net", target: "_blank"}, "servicestack.net"))
            )
      );
    }
});

var routes = (
  React.createElement(Route, {name: "app", path: "/", handler: App}, 
    React.createElement(Route, {name: "connections", handler: Connections}), 
    React.createElement(Route, {name: "search", handler: Search}), 
    React.createElement(Route, {name: "keys", handler: KeyViewer}), 
    React.createElement(DefaultRoute, {handler: Dashboard})
  )
);

Router.run(routes, function (Handler, state) {
    React.render(React.createElement(Handler, null), document.body);

    var name = state.pathname.substring(1);
    document.body.className = (name || 'home') + '-active';
});


Actions.viewInfo();
Actions.loadConnections();