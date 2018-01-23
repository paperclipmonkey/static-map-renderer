'use strict';

var fetch = require('node-fetch');
var stream = require('stream');

var L = require('leaflet-headless');
var document = global.document;

var defaults = require('./defaults.json');

const express = require('express');
var addRequestId = require('express-request-id')();
const app = express();
app.use(addRequestId);

/*
Get image as a buffer instead of as a file
*/
L.Map.prototype.getStream = function () {
    var leafletImage = require('leaflet-image');

    return new Promise((resolve, reject) => {
      leafletImage(this, function (err, canvas) {
          if (err) {
              reject(err);
          }
          var data = canvas.toDataURL().replace(/^data:image\/\w+;base64,/, '');
          var bufferStream = new stream.PassThrough();
          bufferStream.end(new Buffer(data, 'base64'));
          resolve(bufferStream);
      });
    })
};


async function geojsonExample (params) {

    // create an element for the map.
    var element = document.createElement('div');
    element.id = 'map-leaflet-image';
    document.body.appendChild(element);

    var map = L.map(element).setView(params.center, params.zoom);
    map.setSize(params.width, params.height);

    for (let layer of params.tileLayers) {
      L.tileLayer(layer.url, layer.options).addTo(map);
    }

    if(params.markers) {
      for (let marker of params.markers) {
        if (Array.isArray(marker)) {
          L.marker(marker).addTo(map)
        } else {
          L.marker(marker.point, {
            // TODO - Add additional markers
          }).addTo(map)
        }
      }
    }

    if (params.geojson) {
      let geoJSON
      if (typeof params.geojson === 'string') { // External URL - Load
        const resp = await fetch(params.geojson);
        geoJSON = await resp.json();
      } else {
        geoJSON = params.geojson
      }

      // If not wrapped in a feature collection
      if(geoJSON.type !== 'FeatureCollection') {
        geoJSON = {
          "type": "FeatureCollection",
          "features": [{
            "type": "Feature",
            properties: {},
            geometry: geoJSON
          }]
        }
      }
      L.geoJson(geoJSON).addTo(map);

    }

    // if (params.scale) {
    //   if (typeof params.scale === 'object') {
    //     L.control.scale(params.scale).addTo(map);
    //   } else {
    //     L.control.scale().addTo(map);
    //   }
    // }

    return map.getStream().then((res) => {
      map = undefined
      // document.removeChild(element)
      return res
    })
}


app.get('/image/', async (req, res) => {
  console.time('leaflet-image:' + req.id);
  let queryParams = {};
  for (const [key, para] of Object.entries(req.query)) {
    try {
      queryParams[key] = JSON.parse(para)
    } catch (e) {
      queryParams[key] = para
    }
  }

  let params = {
    ...defaults,
    ...queryParams
  }
  const stream = await geojsonExample(params)
  stream.pipe(res)
  console.timeEnd('leaflet-image:' + req.id);
})

const port = process.env.PORT || 3000

app.listen(port, () => console.log(`Example app listening on port ${port}`))
