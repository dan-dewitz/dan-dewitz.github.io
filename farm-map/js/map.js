(function () {
  'use strict';

  const map = L.map('map', {
    center: [40.85, -73.85],
    zoom: 9,
    zoomControl: true
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // Layer groups (all added to map by default)
  const metroNorthLayer = L.layerGroup().addTo(map);
  const lirrLayer       = L.layerGroup().addTo(map);
  const foodDesertLayer = L.layerGroup().addTo(map);
  const nyFarmLayer     = L.layerGroup().addTo(map);
  const njFarmLayer     = L.layerGroup().addTo(map);
  const ctFarmLayer     = L.layerGroup().addTo(map);
  const paFarmLayer     = L.layerGroup().addTo(map);
  const maFarmLayer     = L.layerGroup().addTo(map);

  const METRO_COLOR  = '#2563EB';
  const LIRR_COLOR   = '#DC2626';

  // ── NY Farm Directory — color palette by Primary Farm Type ───────────────────
  const NY_FARM_COLORS = {
    'Livestock Farm':         '#F59E0B',
    'Produce Farm':           '#16A34A',
    'Orchard':                '#EA580C',
    'Dairy Farm':             '#0EA5E9',
    'Vineyard':               '#7C3AED',
    'Horse Farm':             '#92400E',
    'Winery':                 '#9333EA',
    'Nursery/Greenhouse':     '#10B981',
    'Aquaculture':            '#0891B2',
    'Grain Farm':             '#D97706',
    'Christmas Tree Farm':    '#15803D',
    'Maple Products':         '#B45309',
    'Herb Farm':              '#65A30D',
    'Bee Farm / Apiary':      '#FBBF24',
    'Goat Farm':              '#E879F9',
    'Sheep Farm':             '#A78BFA',
    'Vegetable Farm':         '#22C55E',
    'Berry Farm':             '#EC4899',
    'Flower Farm':            '#F472B6',
    'Poultry Farm':           '#FB923C',
  };
  // Stable fallback: hash the type string into one of these extra colours
  const NY_FARM_PALETTE = [
    '#64748B','#0F766E','#B91C1C','#1D4ED8','#7E22CE',
    '#A16207','#166534','#0E7490','#BE185D','#9A3412'
  ];
  function nyFarmColor(type) {
    if (NY_FARM_COLORS[type]) return NY_FARM_COLORS[type];
    let h = 0;
    for (let i = 0; i < type.length; i++) h = (Math.imul(31, h) + type.charCodeAt(i)) | 0;
    return NY_FARM_PALETTE[Math.abs(h) % NY_FARM_PALETTE.length];
  }

  // ── Metro-North ──────────────────────────────────────────────────────────────
  fetch('data/metro-north.geojson')
    .then(r => r.json())
    .then(data => {
      const geoLayer = L.geoJSON(data, {
        style: { color: METRO_COLOR, weight: 3, opacity: 0.85 },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          layer.bindTooltip(
            `<b>Metro-North: ${p.name}</b><br>${p.stations}`,
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setStyle({ weight: 5, opacity: 1 });
          });
          layer.on('mouseout', function () {
            geoLayer.resetStyle(this);
          });
        }
      });
      geoLayer.addTo(metroNorthLayer);
    })
    .catch(err => console.error('metro-north load error:', err));

  // ── LIRR ─────────────────────────────────────────────────────────────────────
  fetch('data/lirr.geojson')
    .then(r => r.json())
    .then(data => {
      const geoLayer = L.geoJSON(data, {
        style: { color: LIRR_COLOR, weight: 3, opacity: 0.85 },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          layer.bindTooltip(
            `<b>LIRR: ${p.name}</b><br>${p.stations}`,
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setStyle({ weight: 5, opacity: 1 });
          });
          layer.on('mouseout', function () {
            geoLayer.resetStyle(this);
          });
        }
      });
      geoLayer.addTo(lirrLayer);
    })
    .catch(err => console.error('lirr load error:', err));

  // ── Bodega-to-Grocery Ratio ───────────────────────────────────────────────────
  // Source: NYC EH Data Portal — "Ratio Bodegas to supermarkets" (2016), by CD.
  // GeoID format: first digit = borough (1=MN,2=BX,3=BK,4=QN,5=SI),
  //               last two digits = community district number.
  const BORO_PREFIX = { '1': 'MN', '2': 'BX', '3': 'BK', '4': 'QN', '5': 'SI' };
  const BODEGA_RATIO = {};
  [
    ['303',57],['307',45],['206',37],['304',31],['501',28],['311',27],
    ['201',25],['301',25],['308',25],['315',25],['309',21],['313',21],
    ['314',21],['317',21],['202',20],['205',20],['310',20],['412',20],
    ['103',18],['204',18],['207',18],['312',18],['111',17],['211',17],
    ['403',17],['402',16],['404',16],['316',15],['405',15],['413',14],
    ['112',13],['209',13],['305',13],['302',12],['306',12],['105',11],
    ['109',11],['110',11],['409',11],['203',10],['208',10],['401',10],
    ['318', 9],['212', 8],['410', 8],['414', 8],['102', 7],['104', 7],
    ['106', 7],['210', 7],['502', 7],['101', 6],['407', 6],['108', 5],
    ['406', 5],['408', 5],['411', 5],['503', 4],['107', 3],
  ].forEach(([geo, ratio]) => {
    const prefix = BORO_PREFIX[geo[0]];
    const cd     = geo.slice(1).padStart(2, '0');
    if (prefix) BODEGA_RATIO[prefix + cd] = ratio;
  });

  // Community districts above the upper IQR fence for bodega:grocery ratio
  const FOOD_INSECURE = new Set([
    'BK01','BK03','BK04','BK07','BK08','BK09','BK11','BK13','BK14','BK15','BK17',
    'BX01','BX06','SI01'
  ]);

// NTA shapefile — residential NTAs only (ntatype='0'), server-side filtered
  const NTA_URL =
    'https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson' +
    "?%24where=ntatype%3D'0'&%24limit=500";

  fetch(NTA_URL)
    .then(r => r.json())
    .then(data => {
      const geoLayer = L.geoJSON(data, {
        style(feature) {
          const cdta     = feature.properties.cdta2020;
          const insecure = FOOD_INSECURE.has(cdta);
          return {
            color:       insecure ? '#f97316' : 'transparent',
            fillOpacity: 0,
            weight:      insecure ? 2.5 : 0,
            opacity:     insecure ? 0.9 : 0,
            dashArray:   insecure ? '6 3' : null,
          };
        },
        onEachFeature(feature, layer) {
          const p        = feature.properties;
          const ratio    = BODEGA_RATIO[p.cdta2020];
          const insecure = FOOD_INSECURE.has(p.cdta2020);
          const ratioLine = ratio !== undefined
            ? `<br><span style="font-weight:600">${ratio} bodegas per supermarket</span>`
            : '<br><span style="color:#6b7280">No ratio data</span>';
          const insecureLine = insecure
            ? '<br><span style="color:#f97316;font-weight:600">⚠ Food Insecure (above IQR)</span>'
            : '';
          layer.bindTooltip(
            `<b>${p.ntaname}</b><br>${p.boroname}${ratioLine}${insecureLine}`,
            { sticky: true }
          );
          layer.on('mouseover', function () {
            if (insecure) this.setStyle({ weight: 3.5 });
          });
          layer.on('mouseout', function () {
            geoLayer.resetStyle(this);
          });
        }
      });
      geoLayer.addTo(foodDesertLayer);
    })
    .catch(err => console.error('bodega-ratio load error:', err));

  // ── NY Farm Directory ─────────────────────────────────────────────────────────
  fetch('data/ny_farms.geojson')
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer(feature, latlng) {
          const color = nyFarmColor(feature.properties.farm_type);
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 1.2,
            opacity: 1,
            fillOpacity: 0.85
          });
        },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          const color = nyFarmColor(p.farm_type);
          const badge = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle"></span>`;
          layer.bindTooltip(
            `<b>${p.name}</b><br>${badge}${p.farm_type}<br>${p.address}, ${p.city} ${p.zip}`,
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setRadius(9);
            this.setStyle({ fillOpacity: 1, weight: 2 });
          });
          layer.on('mouseout', function () {
            this.setRadius(6);
            this.setStyle({ fillOpacity: 0.85, weight: 1.2 });
          });
        }
      }).addTo(nyFarmLayer);
    })
    .catch(err => console.error('ny_farms load error:', err));

  // ── NJ Farm Bureau ────────────────────────────────────────────────────────────
  fetch('data/nj_farms.geojson')
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer(_feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: '#16A34A',
            color: '#fff',
            weight: 1.2,
            opacity: 1,
            fillOpacity: 0.85
          });
        },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          layer.bindTooltip(
            `<b>${p.name}</b><br>${p.address}, ${p.city} ${p.zip}<br>${p.county} County, NJ` +
            (p.phone ? `<br>${p.phone}` : '') +
            (p.hours ? `<br><i>${p.hours}</i>` : ''),
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setRadius(9);
            this.setStyle({ fillOpacity: 1, weight: 2 });
          });
          layer.on('mouseout', function () {
            this.setRadius(6);
            this.setStyle({ fillOpacity: 0.85, weight: 1.2 });
          });
        }
      }).addTo(njFarmLayer);
    })
    .catch(err => console.error('nj_farms load error:', err));

  // ── CT Farms (PickYourOwn.org) ────────────────────────────────────────────────
  fetch('data/ct_farms.geojson')
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer(_feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: '#16A34A',
            color: '#fff',
            weight: 1.2,
            opacity: 1,
            fillOpacity: 0.85
          });
        },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          layer.bindTooltip(
            `<b>${p.name}</b><br>${p.address}, ${p.city} ${p.zip}<br>CT` +
            (p.crops ? `<br><i>${p.crops}</i>` : '') +
            (p.phone ? `<br>${p.phone}` : '') +
            (p.hours ? `<br>${p.hours}` : ''),
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setRadius(9);
            this.setStyle({ fillOpacity: 1, weight: 2 });
          });
          layer.on('mouseout', function () {
            this.setRadius(6);
            this.setStyle({ fillOpacity: 0.85, weight: 1.2 });
          });
        }
      }).addTo(ctFarmLayer);
    })
    .catch(err => console.error('ct_farms load error:', err));

  // ── PA Farms (PickYourOwn.org) ────────────────────────────────────────────────
  fetch('data/pa_farms.geojson')
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer(_feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: '#16A34A',
            color: '#fff',
            weight: 1.2,
            opacity: 1,
            fillOpacity: 0.85
          });
        },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          layer.bindTooltip(
            `<b>${p.name}</b><br>${p.address}, ${p.city} ${p.zip}<br>PA` +
            (p.crops ? `<br><i>${p.crops}</i>` : '') +
            (p.phone ? `<br>${p.phone}` : '') +
            (p.hours ? `<br>${p.hours}` : ''),
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setRadius(9);
            this.setStyle({ fillOpacity: 1, weight: 2 });
          });
          layer.on('mouseout', function () {
            this.setRadius(6);
            this.setStyle({ fillOpacity: 0.85, weight: 1.2 });
          });
        }
      }).addTo(paFarmLayer);
    })
    .catch(err => console.error('pa_farms load error:', err));

  // ── MA Farms (PickYourOwn.org) ────────────────────────────────────────────────
  fetch('data/ma_farms.geojson')
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer(_feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: '#16A34A',
            color: '#fff',
            weight: 1.2,
            opacity: 1,
            fillOpacity: 0.85
          });
        },
        onEachFeature(feature, layer) {
          const p = feature.properties;
          layer.bindTooltip(
            `<b>${p.name}</b><br>${p.address}, ${p.city} ${p.zip}<br>MA` +
            (p.crops ? `<br><i>${p.crops}</i>` : '') +
            (p.phone ? `<br>${p.phone}` : '') +
            (p.hours ? `<br>${p.hours}` : ''),
            { sticky: true }
          );
          layer.on('mouseover', function () {
            this.setRadius(9);
            this.setStyle({ fillOpacity: 1, weight: 2 });
          });
          layer.on('mouseout', function () {
            this.setRadius(6);
            this.setStyle({ fillOpacity: 0.85, weight: 1.2 });
          });
        }
      }).addTo(maFarmLayer);
    })
    .catch(err => console.error('ma_farms load error:', err));

  // ── Layer Control ─────────────────────────────────────────────────────────────
  L.control.layers(null, {
    'Metro-North Routes': metroNorthLayer,
    'LIRR Routes':        lirrLayer,
    'Bodega:Grocery Ratio': foodDesertLayer,
    'NY Farm Directory':  nyFarmLayer,
    'NJ Farm Directory':  njFarmLayer,
    'CT Farm Directory':  ctFarmLayer,
    'PA Farm Directory':  paFarmLayer,
    'MA Farm Directory':  maFarmLayer
  }, { collapsed: false }).addTo(map);

})();
