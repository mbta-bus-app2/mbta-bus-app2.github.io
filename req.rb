#!/usr/bin/env ruby
# writes new stops.js file and outputs it to stdout as well

require 'net/http'
require 'rubygems'
require 'json'

def get path
  url = URI.parse(path)
  req = Net::HTTP::Get.new(path)
  res = Net::HTTP.start(url.host, url.port) {|http|
    http.request(req)
  }
  res.body
end

routesXML = get 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=mbta'
routes = routesXML.scan(/tag="([^"]+)" title="([^"]+)"/)

stops = {};

routes.each do |(route_id, route_title)|
  sleep 11
  # clean up the MBTA NextBus API's route titles a little bit
  route_title = route_title\
    .sub('Silver Line SL', 'SL')\
    .sub('Silver Line Waterfront', 'SLWay')\
    .sub(/^Ct/, 'CT')
  STDERR.puts "#{route_title}.."
  begin
    stopsXML = get "http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=mbta&r=#{route_id}"
    stopsTags = stopsXML.scan(/<stop tag="[^"]*" title="[^"]*" lat="[^"]*" lon="[^"]*" stopId="[^"]*"\/>/)

    stopsTags.each do |stopTag|
      id = /stopId="([^"]+)"/.match(stopTag)[1]
      if stops[id].nil?
        stops[id] = {
          :id => id,
          :lat => /lat="([^"]+)"/.match(stopTag)[1].to_f,
          :lon => /lon="([^"]+)"/.match(stopTag)[1].to_f,
          :title => /title="([^"]+)"/.match(stopTag)[1],
          :routes => [route_title]
        }
      else
        stops[id][:routes].push route_title
      end
    end
#  rescue
#    STDERR.puts "An error occurred for route #{route_title}"
  end
end

puts JSON.dump stops.values

f = open 'stops.js', 'w'
f.write ('var stops = ' + JSON.dump(stops.values))
