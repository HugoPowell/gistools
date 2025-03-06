// Define the geometry of the City of Nyon, Vaud, Switzerland
var nyon = ee.Geometry.Polygon([
  [[6.217, 46.410], [6.267, 46.410], [6.267, 46.370], [6.217, 46.370], [6.217, 46.410]]
]);

// Function to calculate NDVI for a given image
var calculateNDVI = function(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
};

// Sentinel-2 (2015 onwards)
var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(nyon)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

// Landsat 8 (2013-2015)
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(nyon)
  .filter(ee.Filter.lt('CLOUD_COVER', 20));

// Function to calculate NDVI for Landsat 8
var calculateNDVI_Landsat8 = function(image) {
  return image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
};

// Get NDVI for a specific year (July only)
var getNDVIForYear = function(year) {
  if (year < 2015) {
    var image = landsat8.filterDate(year + '-07-01', year + '-07-31').mean();
    return calculateNDVI_Landsat8(image).clip(nyon).set('year', year);
  } else {
    var image = s2.filterDate(year + '-07-01', year + '-07-31').mean();
    return calculateNDVI(image).clip(nyon).set('year', year);
  }
};

// List of years to analyze
var years = [2013, 2014, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// Collect NDVI images for each year
var ndviImages = years.map(getNDVIForYear);

// Calculate year-on-year NDVI differences
var ndviDifferences = [];
for (var i = 1; i < ndviImages.length; i++) {
  var diff = ndviImages[i].subtract(ndviImages[i-1])
               .rename('NDVI_Change')
               .set('year_pair', years[i-1] + '-' + years[i]);
  ndviDifferences.push(diff);
}

// Calculate average year-on-year NDVI change
var avgNDVIChange = ee.ImageCollection(ndviDifferences).mean().rename('Average_Yearly_NDVI_Change');

// Visualization parameters
var ndviVis = {min: 0, max: 1, palette: ['red', 'yellow', 'green']};
var diffVis = {min: -0.2, max: 0.2, palette: ['blue', 'white', 'red']};

// Center map on Nyon
Map.centerObject(nyon, 12);

// Add UI panel to control layers
var controlPanel = ui.Panel({style: {position: 'top-right', padding: '8px'}});

years.forEach(function(year, index) {
  var layer = ui.Map.Layer(ndviImages[index], ndviVis, 'NDVI ' + year);
  Map.layers().add(layer);

  var checkbox = ui.Checkbox('Show NDVI ' + year, true, function(checked) {
    layer.setShown(checked);
  });
  controlPanel.add(checkbox);

  // --- Calculate healthy vs unhealthy areas ---
  var ndvi = ndviImages[index];
  var healthy = ndvi.gte(0.4);
  var unhealthy = ndvi.lt(0.4);

  var areaImage = ee.Image.pixelArea();

  var healthyArea = healthy.multiply(areaImage).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: nyon,
    scale: 10,
    maxPixels: 1e13
  }).getNumber('NDVI');

  var unhealthyArea = unhealthy.multiply(areaImage).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: nyon,
    scale: 10,
    maxPixels: 1e13
  }).getNumber('NDVI');

  var totalArea = healthyArea.add(unhealthyArea);
  var healthyPercent = healthyArea.divide(totalArea).multiply(100);
  var unhealthyPercent = unhealthyArea.divide(totalArea).multiply(100);

  // Print to console
  print('Year ' + year + ' - Healthy vs Unhealthy Greenery:');
  print('Healthy: ', healthyPercent.format('%.2f'), '%');
  print('Unhealthy: ', unhealthyPercent.format('%.2f'), '%');
});

// Add average NDVI change layer toggle
var avgNDVILayer = ui.Map.Layer(avgNDVIChange, diffVis, 'Average Yearly NDVI Change');
Map.layers().add(avgNDVILayer);

var avgDiffToggle = ui.Checkbox('Show Average NDVI Change', true, function(checked) {
  avgNDVILayer.setShown(checked);
});
controlPanel.add(avgDiffToggle);

Map.add(controlPanel);

// --- Year-on-year NDVI change analysis ---
ndviDifferences.forEach(function(diff, index) {
  var yearPair = diff.get('year_pair');

  var increased = diff.gt(0.05);
  var decreased = diff.lt(-0.05);

  var areaImage = ee.Image.pixelArea();

  var increasedArea = increased.multiply(areaImage).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: nyon,
    scale: 10,
    maxPixels: 1e13
  }).getNumber('NDVI_Change');

  var decreasedArea = decreased.multiply(areaImage).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: nyon,
    scale: 10,
    maxPixels: 1e13
  }).getNumber('NDVI_Change');

  var totalChangeArea = increasedArea.add(decreasedArea);
  var increasedPercent = increasedArea.divide(totalChangeArea).multiply(100);
  var decreasedPercent = decreasedArea.divide(totalChangeArea).multiply(100);

  // Print to console
  print('NDVI Change ' + yearPair + ' - Greenery Health Change:');
  print('Increased: ', increasedPercent.format('%.2f'), '%');
  print('Decreased: ', decreasedPercent.format('%.2f'), '%');
});

// Create legend for NDVI and NDVI Change
var legend = ui.Panel({
  style: {position: 'bottom-left', padding: '8px 15px'}
});

var legendTitle = ui.Label({
  value: 'NDVI & Change Legend',
  style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'}
});
legend.add(legendTitle);

var makeLegendRow = function(color, name) {
  return ui.Panel({
    widgets: [
      ui.Label({style: {backgroundColor: color, padding: '8px', margin: '0 0 4px 0'}}),
      ui.Label({value: name, style: {margin: '0 0 4px 6px'}})
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

// Add legends
[['red', 'Low NDVI'], ['yellow', 'Medium NDVI'], ['green', 'High NDVI']].forEach(function(pair) {
  legend.add(makeLegendRow(pair[0], pair[1]));
});
legend.add(ui.Label('Change in NDVI', {fontWeight: 'bold'}));
[['blue', 'Decrease'], ['white', 'No Change'], ['red', 'Increase']].forEach(function(pair) {
  legend.add(makeLegendRow(pair[0], pair[1]));
});
Map.add(legend);
