L.TileLayer.Kothic = L.TileLayer.Canvas.extend({
	options: {
		tileSize: 256 * 4,
		zoomOffset: 2,
		minZoom: 2,
		maxZoom: 22,
		updateWhenIdle: true,
		unloadInvisibleTiles: true,
		attribution: 'Map data &copy; 2011 OpenStreetMap contributors, Rendering by <a href="http://github.com/kothic/kothic-js">Kothic JS</a>',
		async: true,
		buffered: false
	},

	initialize: function(options) {
		L.Util.setOptions(this, options);

		this._canvases = {};
		this._debugMessages = [];

		this.options.styles = options.styles || MapCSS.availableStyles;

		window.onKothicDataResponse = L.Util.bind(this._onKothicDataResponse, this);

        this.kothic = new Kothic({
            buffered: this.options.buffered,
            styles: this.options.styles,
            locales: ['be', 'ru', 'en']
        });
	},

	_onKothicDataResponse: function(data, zoom, x, y) {
		var key = [zoom, x, y].join('/'),
			canvas = this._canvases[key],
			zoomOffset = this.options.zoomOffset,
			layer = this;

		function onRenderComplete(debugInfo) {
			// TODO move this logic outside
			var debugStr = layer.getDebugStr(debugInfo, x, y, zoom);
			layer._debugMessages.push(debugStr);
			layer.tileDrawn(canvas);
		}

        this._invertYAxe(data)

		this.kothic.render(canvas, data, zoom + zoomOffset, onRenderComplete);
		delete this._canvases[key];
	},

	getDebugStr: function(trace, x, y, zoom) {
        var msg = '<b>tile ' + x + ':' + y + ':' + zoom + '</b><br />';
        msg += '<table>';
        
        for (var k in trace.stats) {
            if (!trace.stats.hasOwnProperty(k)) {
                continue;
            }
            msg += '<tr><td>' + trace.stats[k] + '</td><td>' + k + '</td></tr>';
        }
        
        msg += '</table><table>';
        
        var tPrev = trace.events[0].timestamp, start = tPrev;
        for (var i = 1; i < trace.events.length; i++) {
            msg += '<tr><td>' + (trace.events[i].timestamp - tPrev) + '&nbsp;ms</td><td>' + trace.events[i].message + '</td></tr>';
            tPrev = trace.events[i].timestamp;
        }
        
        msg += '<tr><td>' + (tPrev - start) + '&nbsp;ms</td><td>total</td></tr>';
        msg += '</table>';
        return msg;
	},

	getDebugMessages: function() {
		return this._debugMessages;
	},

	drawTile: function(canvas, tilePoint, zoom) {
		var zoomOffset = this.options.zoomOffset,
			key = [(zoom - zoomOffset), tilePoint.x, tilePoint.y].join('/');

		this._canvases[key] = canvas;
		this._loadScript('http://osmosnimki.ru/vtile/' + key + '.js');        
	},
    
    enableStyle: function(name) {
        if (MapCSS.availableStyles.indexOf(name) >= 0 && this.options.styles.indexOf(name) < 0) {
            this.options.styles.push(name);
            this.redraw();
        }
    },

    disableStyle: function(name) {
        if (this.options.styles.indexOf(name) >= 0) {
            this.options.styles.remove(name);
            this.redraw();
        }
    },

    redraw: function() {
        MapCSS.invalidateCache();
		// TODO implement layer.redraw() in Leaflet
		this._map.getPanes().tilePane.empty = false;
		if (this._map && this._map._container) {
			this._reset();
			this._update();
		}
    },
    
    _invertYAxe: function(data) {
        var type, coordinates, tileSize = data.granularity, i, j, k, l, feature;
        for (i = 0; i < data.features.length; i++) {
            feature = data.features[i];
            coordinates = feature.coordinates;
            type = data.features[i].type;
            if (type == 'Point') {
                coordinates[1] = tileSize - coordinates[1];
            } else if (type == 'MultiPoint' || type == 'LineString') {
                for (j = 0; j < coordinates.length; j++) {
                    coordinates[j][1] = tileSize - coordinates[j][1];
                }
            } else if (type == 'MultiLineString' || type == 'Polygon') {
                for (k = 0; k < coordinates.length; k++) {
                    for (j = 0; j < coordinates[k].length; j++) {
                        coordinates[k][j][1] = tileSize - coordinates[k][j][1];
                    }
                }
            } else if (type == 'MultiPolygon') {
                for (l = 0; l < coordinates.length; l++) {
                    for (k = 0; k < coordinates[l].length; k++) {
                        for (j = 0; j < coordinates[l][k].length; j++) {
                            coordinates[l][k][j][1] = tileSize - coordinates[l][k][j][1];
                        }
                    }
                }
            } else {
                window.console && window.console.log("Unexpected GeoJSON type: " + type);
            }
            
            if ('reprpoint' in feature) {
                feature.reprpoint[1] = tileSize - feature.reprpoint[1];
            }
        }
    },

	_loadScript: function(url) {
		var script = document.createElement('script');
		script.src = url;
		script.charset = 'utf-8';
		document.getElementsByTagName('head')[0].appendChild(script);
	}
});
