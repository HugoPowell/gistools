// Define the geometry of the City of Nyon, Vaud, Switzerland
var nyon = ee.Geometry.Polygon([
  [[6.217, 46.410], [6.267, 46.410], [6.267, 46.370], [6.217, 46.370], [6.217, 46.410]]
]);

// Function to calculate NDVI for a given image
var calculateNDVI = function(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
};

// Get Sentinel-2 Surface Reflectance collection
var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(nyon)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

// Function to get NDVI image for a specific year and month
var getNDVIForYear = function(year) {
  var image = s2.filterDate(year + '-04-01', year + '-04-30')
    .sort('system:time_start', false)
    .first();
  return calculateNDVI(image).clip(nyon).set('year', year);
};

// Retrieve NDVI images different years
var years = [2020, 2021, 2022, 2023, 2024];
var ndviImages = years.map(getNDVIForYear);

// Calculate NDVI difference between latest and 2020
var ndviDifference = ndviImages[4].subtract(ndviImages[0]).rename('NDVI_Difference');

// Visualization parameters
var ndviVis = {min: 0, max: 1, palette: ['red', 'yellow', 'green']};
var diffVis = {min: -0.5, max: 0.5, palette: ['blue', 'white', 'red']};

Map.centerObject(nyon, 12);

// Create layer toggles with year labels
var controlPanel = ui.Panel({
  style: {position: 'top-right', padding: '8px'}
});

var layers = [];

years.forEach(function(year, index) {
  var layer = ui.Map.Layer(ndviImages[index], ndviVis, 'NDVI ' + year);
  Map.layers().add(layer);
  layers.push(layer);

  var checkbox = ui.Checkbox('Show NDVI ' + year, true, function(checked) {
    layer.setShown(checked);
  });
  controlPanel.add(checkbox);
});

// Add NDVI difference layer
var ndviDiffLayer = ui.Map.Layer(ndviDifference, diffVis, 'NDVI Difference');
Map.layers().add(ndviDiffLayer);

var diffToggle = ui.Checkbox('Show NDVI Difference', true, function(checked) {
  ndviDiffLayer.setShown(checked);
});
controlPanel.add(diffToggle);

Map.add(controlPanel);

// Create a single legend for NDVI and NDVI change
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

var legendTitle = ui.Label({
  value: 'NDVI & Change Legend',
  style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0', padding: '0'}
});
legend.add(legendTitle);

var makeLegendRow = function(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });

  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px'}
  });

  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

var ndviPalette = ['red', 'yellow', 'green'];
var ndviNames = ['Low NDVI', 'Medium NDVI', 'High NDVI'];
var diffPalette = ['blue', 'white', 'red'];
var diffNames = ['Decrease in Greenery', 'No Change', 'Increase in Greenery'];

ndviPalette.forEach(function(color, i) {
  legend.add(makeLegendRow(color, ndviNames[i]));
});

legend.add(ui.Label({value: 'NDVI Change', style: {fontWeight: 'bold', margin: '10px 0 4px 0'}}));

diffPalette.forEach(function(color, i) {
  legend.add(makeLegendRow(color, diffNames[i]));
});

Map.add(legend);
