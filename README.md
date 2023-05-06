# Barometer for Signal K
Simple barometer plugin that does a few things:

* Publishes `environment.{zone}.pressure.[oneHourAgo, threeHoursAgo, twelveHoursAgo, oneDayAgo, twoDaysAgo]` and `environment.{zone}.pressure.[oneHourDelta, threeHoursDelta, twelveHoursDelta, oneDayDelta, twoDaysDelta]`
* Zone can be specificied (e.g. `inside` or `outside`)
* Optionally publishes notifications if pressure drops significantly (at least 1 hPa per hour) over 12 or 24 hours 
* Provides a webapp to visualize the trend over 48 hours.

![See screenshot](screenshot.png)
