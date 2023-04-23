/*
 * Copyright 2022 Ilker Temir <ilker@ilkertemir.com>
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const filePath = require('path');
const fs = require('fs');

module.exports = function(app) {
  var plugin = {};

  plugin.id = "barometer";
  plugin.name = "Barometer";
  plugin.description = "A simple barometer with notifications";
  var unsubscribes = [];
  var pressureReadings;

  plugin.start = function(options) {
    const dataFile = filePath.join(app.getDataDirPath(), 'readings.json');
    if (fs.existsSync(dataFile)) {
       pressureReadings = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
       for (let i in pressureReadings) {
         pressureReadings[i].date = new Date(pressureReadings[i].date);
       }
       app.debug(`Read ${pressureReadings.length} saved readings.`);
    } else {
       pressureReadings = [];
    }

    function processDelta(data) {
      let dict = data.updates[0].values[0];
      let path = dict.path;
      let value = dict.value;
      switch (path) {
        case `environment.${options.source}.pressure`:
          let now = new Date();
          pressureReadings.push({
            date: now,
            value: value
          });
          // Only keep 48 hours of data
          pressureReadings = pressureReadings.filter(item => (now - item.date) <= 48*60*60*1000);
          // Save for restarts but don't overwrite if empty
          if (pressureReadings.length > 0) {
            fs.writeFileSync(dataFile, JSON.stringify(pressureReadings) , 'utf-8');
          }
          break;
        default:
          app.error('Unknown path: ' + path);
      }
    }
  
    function findReadingAgo(hours) {
      let now = new Date();
      let target = now - hours*60*60*1000;
      // Check within 10 minutes of target
      let lowerLimit = target - 50*60*1000;
      let upperLimit = target + 50*60*1000;
      let readingsWithinRange = pressureReadings.filter(item => item.date >= lowerLimit && item.date <= upperLimit);
      let readingsWithinRangeValues = Array.from(Object.values(readingsWithinRange), item => item.value);
      if (readingsWithinRangeValues.length > 0) {
        let readingsAverage = Math.round(readingsWithinRangeValues.reduce((p,c,_,a) => p + c/a.length,0));     
        return(readingsAverage);
      } else {
        return (null);
      }
    }

    function publishReadings() {
      let oneHourAgo = findReadingAgo(1);
      let oneDayAgo = findReadingAgo(24);
      let twoDaysAgo = findReadingAgo(48);
      app.debug(`Publishing barometer reading for one hour, day and two days ago (${oneHourAgo}, ${oneDayAgo}, ${twoDaysAgo}`);
 
      var values = [];
      if (oneHourAgo) {
        values.push ({
          path: `environment.${options.source}.pressureReadings.oneHourAgo`,
          value: oneHourAgo
        }); 
      }
      if (oneDayAgo) {
        values.push({ 
          path: `environment.${options.source}.pressureReadings.oneDayAgo`,
          value: oneDayAgo,
        });
      }
      if (twoDaysAgo) {
        values.push({
          path: `environment.${options.source}.pressureReadings.twoDaysAgo`,
          value: twoDaysAgo
        });
      }
      app.handleMessage('barometer', {
        updates: [{
          values: values
        }]
      });
    }

    let subscription = {
      context: 'vessels.self',
      subscribe: [{
        path: `environment.${options.source}.pressure`,
        period: 5*60*1000  // We don't need to read more than every few minutes
      }]
    };

    app.subscriptionmanager.subscribe(subscription, unsubscribes, function() {
      app.error('Subscription error');
    }, data => processDelta(data));
 
    // Publish every 2 seconds
    setInterval( function() {
      publishReadings();
    }, 2000);
  }

  plugin.stop =  function() {
  };

  plugin.schema = {
    type: 'object',
    required: ['source'],
    properties: {
      source: {
        type: 'string',
        title: 'Pressure Source',
        'default': 'outside'
      }
    }
  }

  return plugin;
}
