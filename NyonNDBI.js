// Define the center point of Nyon, Switzerland.
var nyonCenter = ee.Geometry.Point([6.238, 46.383]);

// Define the study area as a 5 km buffer around the center.
var studyArea = nyonCenter.buffer(5000);

// Function to mask clouds for Landsat 8/9 Collection 2 SR.
function maskClouds(image) {
    var qa = image.select('QA_PIXEL');
    var cloudMask = qa.bitwiseAnd(1 << 3) // Cloud
                    .or(qa.bitwiseAnd(1 << 4)) // Cloud Shadow
                    .or(qa.bitwiseAnd(1 << 5)); // Snow
    return image.updateMask(cloudMask.not());
}

// Load the latest available imagery - Landsat 9 or Landsat 8.
var startDate = '2023-06-01';
var endDate = '2023-09-30'; // Summer imagery preferred to reduce snow cover.

// Load Landsat 9 (most recent).
var landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
    .filterBounds(studyArea)
    .filterDate(startDate, endDate)
    .map(maskClouds);

// Fallback to Landsat 8 if needed.
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(studyArea)
    .filterDate(startDate, endDate)
    .map(maskClouds);

// Merge Landsat 9 & 8 and pick the median image.
var combined = landsat9.merge(landsat8);
var latestImage = combined.median();

// Apply scale factors (Landsat Collection 2 Level 2 requires this).
var scaled = latestImage.multiply(0.0000275).add(-0.2);

// Calculate NDBI: (SWIR1 - NIR) / (SWIR1 + NIR)
var ndbi = scaled.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');

// **Loosen the NDBI threshold to capture more built-up areas**: Use NDBI > -0.1
var builtUp = ndbi.gt(-0.1).selfMask(); // This threshold is more permissive

// Add NDBI and built-up layer to the map.
Map.centerObject(studyArea, 12);
Map.addLayer(ndbi.clip(studyArea), {min: -0.5, max: 0.5, palette: ['blue', 'white', 'red']}, 'NDBI (2023)');
Map.addLayer(builtUp.clip(studyArea), {palette: ['red']}, 'Built-up Areas');

// Outline the study area.
Map.addLayer(ee.Image().toByte().paint(studyArea, 1, 2), {palette: 'cyan'}, 'Study Area Boundary');

// Add a legend for NDBI.
function addLegend() {
    var legend = ui.Panel({
        style: {position: 'bottom-right', padding: '8px', backgroundColor: 'rgba(255,255,255,0.8)'}
    });
    
    legend.add(ui.Label('NDBI Legend', {fontWeight: 'bold'}));
    
    function makeRow(color, label) {
        var colorBox = ui.Label('', {backgroundColor: color, padding: '8px', margin: '0'});
        var description = ui.Label(label, {margin: '0 0 0 6px'});
        return ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal'));
    }
    
    legend.add(makeRow('blue', 'Low NDBI (Water/Green)'));
    legend.add(makeRow('white', 'Neutral (Mix)'));
    legend.add(makeRow('red', 'High NDBI (Urban)'));
    
    Map.add(legend);
}

// Call the function to add the legend
addLegend();
