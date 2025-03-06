// Define the region of interest (Nyon, Switzerland)
var nyon = ee.Geometry.Point([6.2396, 46.3833]);

// Define the years of interest (excluding 2015, 2016, 2017)
var years = [2013, 2014, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// Function to calculate the average July temperature for a given year
var getJulyTemp = function(year) {
  var start = ee.Date.fromYMD(year, 7, 1);
  var end = ee.Date.fromYMD(year, 7, 31);

  var lst = ee.ImageCollection("MODIS/061/MOD11A2")
    .filterDate(start, end)
    .select("LST_Day_1km") // Daytime Land Surface Temperature
    .mean()
    .multiply(0.02) // Scale factor to convert to Celsius
    .subtract(273.15) // Convert from Kelvin to Celsius
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: nyon,
      scale: 1000,
      bestEffort: true
    });

  return ee.Feature(null, {year: year, temperature: lst.get("LST_Day_1km")});
};

// Function to calculate total rainfall for July in a given year
var getJulyRainfall = function(year) {
  var start = ee.Date.fromYMD(year, 7, 1);
  var end = ee.Date.fromYMD(year, 7, 31);

  var rainfall = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    .filterDate(start, end)
    .select("precipitation")
    .sum() // Sum of daily rainfall for July
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: nyon,
      scale: 5000,
      bestEffort: true
    });

  return ee.Feature(null, {year: year, rainfall: rainfall.get("precipitation")});
};

// Map over the years to create FeatureCollections
var tempCollection = ee.FeatureCollection(years.map(getJulyTemp));
var rainCollection = ee.FeatureCollection(years.map(getJulyRainfall));

// Merge both datasets into one FeatureCollection
var mergedCollection = tempCollection.map(function(feature) {
  var year = feature.get("year");
  var rainFeature = rainCollection.filter(ee.Filter.eq("year", year)).first();
  return feature.set("rainfall", rainFeature.get("rainfall"));
});

// Print results in a structured format
print("Average July Temperature & Rainfall in Nyon (°C & mm):");
mergedCollection.aggregate_array("year").evaluate(function(yearsList) {
  mergedCollection.aggregate_array("temperature").evaluate(function(tempList) {
    mergedCollection.aggregate_array("rainfall").evaluate(function(rainList) {
      for (var i = 0; i < yearsList.length; i++) {
        print(yearsList[i] + ": " + tempList[i] + "°C, " + rainList[i] + " mm");
      }
    });
  });
});

// Create a combined chart
var chart = ui.Chart.feature.byFeature(mergedCollection, "year", ["temperature", "rainfall"])
  .setChartType("ComboChart")
  .setOptions({
    title: "Average July Temperature & Rainfall in Nyon (2013-2024, excl. 2015-2017)",
    hAxis: {title: "Year"},
    vAxes: {
      0: {title: "Temperature (°C)"},
      1: {title: "Rainfall (mm)", format: 'short'}
    },
    series: {
      0: {type: "line", targetAxisIndex: 0, color: "red"},
      1: {type: "bars", targetAxisIndex: 1, color: "blue"}
    },
    lineWidth: 2,
    pointSize: 4
  });

// Display the chart
print(chart);
