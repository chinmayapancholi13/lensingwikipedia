var currentFacet;
var topCount = 5;
var smooth_k = 5;

/*
 * Setup the control in some container element.
 * container: container element as a jquery selection
 * initialQuery: the initial (empty) query
 * globalQuery: the global query
 */
function setupCompare(container, globalQuery, facets) {
	/************************** CONSTANTS *****************************/
	// The view space for SVG; this doesn't have to correspond to screen units.
	var viewBox = { x: 0, y : 0, width: 1024, height: 768 };
	// Margins for the main graphs (but not for the axes and axes labels, which go in the margin space).
	var margins = { left: 50, right: 30, top: 40, bottom: 35, between: 40 };
	var split = 0.6;

	var width = viewBox.width - margins.left - margins.right;
	var height = viewBox.height - margins.top - margins.bottom - margins.between;
	var detailBox = {
		x: viewBox.x + margins.left,
		y: viewBox.y + margins.top,
		width: width,
		height: height * split
	};
    var selectBox = {
		x: viewBox.x + margins.left,
		y: viewBox.y + margins.top + detailBox.height + margins.between,
		width: width,
		height: height * (1.0 - split)
	};

    /************************* BEGIN BUILD UI *************************/

	var outerElt = $('<div class="compare"></div>').appendTo(container);

	var formElt = $("<form></form>").appendTo(outerElt);
	var clearSelElt = $('<button type="button" class="btn btn-mini btn-warning clear mapclear" title="Clear">Clear selection</button>').appendTo(formElt);
	var modeElt = $('<select class="btn btn-mini"></select>').appendTo(formElt);
	var updateElt = $('<button type="submit" class="btn btn-warning" title="Update the visualization">Update</button></ul>').appendTo(formElt);

	var svgElt = $('<svg id="comparesvg"</svg>').appendTo(outerElt);
	//var contentElt = $('<div id="compare-content"></div>').appendTo(outerElt);

	var loadingIndicator = new LoadingIndicator(outerElt);

	function setLoadingIndicator(enabled) {
		//svgElt.css('display', !enabled ? '' : 'none');
		loadingIndicator.enabled(enabled);
	}

	$.each(facets, function(idx, facet) {
		$('<option value="' + idx + '">' + facet.title + ' facet</option>').appendTo(modeElt);
	});

	fillElement(container, outerElt, 'vertical');

	/************************* END BUILD UI **************************/

	/********************** BEGIN CALLBACKS **************************/

	clearSelElt.click(function(event) {
		//clearElement(contentElt);
	});

	updateElt.click(function(event) {
		//clearElement(contentElt);
		setLoadingIndicator(true);

		currentFacet = facets[Number(modeElt[0].value)];

		currentFacet.constraintsQuery.onResult({
			counts: {
				type: 'countbyfieldvalue',
				field: currentFacet.field
			}
		}, function(result) {
			// TODO: This function will be called once for each constraints.
			//		 It might be a good idea to check if it was already
			//		 executed so we don't reload too many times.
			var topNames = [];

			$.each(result.counts.counts, function(idx, count) {
				if (idx < topCount)
					topNames.push(count[0]);
			});

			var allPairs = [];
			var allNames = [];
			$.each(topNames, function(idx, name) {
				//$('<p>' + name + '</p>').appendTo(contentElt);
				console.log("Got new name: " + name);
				allNames.push(name);
				getYearlyCountsForName(currentFacet.field, name, function(res) {
					// TODO do something wih the yearly counts we get here.
					var pairs = buildYearCountObjects(res.counts.counts);
					var smoothed = smoothData(pairs, "count", smooth_k);

					console.log("Got counts!");

					allPairs.push({name: name, counts: pairs});

					// check if we've gotten counts for all top X names
					// This is a callback, so this is the only way we can do
					// this
					if (allPairs.length == topCount) {
						drawCompare(width, height, margins,
									allNames, combineCounts(allPairs));
						setLoadingIndicator(false);
					}
				});
			});
		});
		currentFacet.constraintsQuery.update();
	});

	// disable form because we don't want to refresh the page
	formElt.submit(function() {
		return false;
	});

	/********************* END CALLBACKS ****************************/
}

/****************** HELPERS *****************************************/
function getYearlyCountsForName(field, name, callback) {
	var query = new Query(globalQuery.backendUrl());
	var nameConstraint = new Constraint();

	query.addConstraint(nameConstraint);

	nameConstraint.set({
		type: 'fieldvalue',
		field: field,
		value: name
	});

	query.onResult({
		counts: {
			type: 'countbyyear'
		}
	}, callback);

	query.update();
}

function buildYearCountObjects(data) {
	// data is assumed to be the result.counts.counts array returned by the
	// backend which objects with year == obj[0] and count == obj[1]

	objs = new Array();

	$.each(data, function(idx, obj) {
		objs.push({
			year: obj[0],
			count: obj[1]
		});
	});

	return objs;
}

function clearElement(element) {
	element.html("");
}


function smoothData(data, attribute, k) {
	if (k == 0) {
		return data;
	}

	var samples = [];

	for (i = 0; i < data.length; i++) {
		var start_at = (i-k) < 0 ? 0 : i - k;
		var end_at = (i+k) >= data.length ? data.length : i + k;

		var smooth_sum = 0;

		for (j = start_at; j < end_at; j++) {
			smooth_sum += data[j][attribute];
		}

		smooth_sum /= end_at - start_at;

		sample = data[i];
		sample[attribute] = smooth_sum;

		samples.push(sample);
	}

	return samples;
}

function combineCounts(data) {
	// This function expects data as an array.
	// Each element is an object {name: "Augustus", counts: Array()}.
	// Counts is the array returned by buildYearCountObjects.
	// It will return a single array of each of these arrays merged together,
	// [{year: X, "Augustus": C1, "Name2": C2},...]

	// perYearCounts will contains {2001: {"Augustus": 0, "Name2": 3}, 2002: ...}
	var perYearCounts = {};

	$.each(data, function(i, d) {
		$.each(d.counts, function(j, count) {
			if (!(count.year in perYearCounts)) {
				perYearCounts[count.year] = {};
			}

			perYearCounts[count.year][d.name] = count.count;
		});
	});

	var ret = new Array();

	for (var year in perYearCounts) {
		var flat_year = {year: year};

		for (var name in perYearCounts[year]) {
			flat_year[name] = perYearCounts[year][name];
		}

		ret.push(flat_year);
	}

	return ret;
}

function drawCompare(width, height, margins, names, data) {
	// data is allPairs

	var parseDate = d3.time.format("%Y").parse;

	d3.select("#comparesvg").selectAll("*").remove();

	var svg = d3.select("#comparesvg")
			.attr("width", width)
			.attr("height", height)
		.append("g")
			.attr("transform", "translate(" + margins.left + "," + 0 + ")");

	var plotWidth = width - margins.left - margins.right;
	var plotHeight = height - margins.top - margins.bottom - margins.between;

	var x = d3.time.scale().range([0, plotWidth]);
	var y = d3.scale.linear().range([plotHeight, 0]);
	var color = d3.scale.category10();

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");

	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left");

  data.forEach(function(d) {
		var jsYear = +d.year;
		// The input data represents n BCE as -n whereas Javascript uses 1-n
		if (jsYear < 0)
			jsYear += 1;
		var date = new Date(0, 0, 1);
		date.setFullYear(jsYear);
    d.date = date;
  });

	data.sort(function(a, b) {
		return a.date - b.date;
	});

	var line = d3.svg.line()
		.interpolate("basis")
		.x(function(d) { return x(d.date); })
		.y(function(d) { return y(d.count); });

  color.domain(names);

  var persons = names.map(function(name) {
    return {
      name: name,
      values: data.map(function(d) {
				var c = +d[name];
				if (isNaN(c))
					c = 0.0;
        return {date: d.date, count: c};
      })
    };
  });

  x.domain(d3.extent(data, function(d) { return d.date; }));

  y.domain([
    d3.min(persons, function(c) { return d3.min(c.values, function(v) { return v.count; }); }),
    d3.max(persons, function(c) { return d3.max(c.values, function(v) { return v.count; }); })
  ]);

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + plotHeight + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Count");

  var person = svg.selectAll(".person")
      .data(persons)
    .enter().append("g")
      .attr("class", "person");

  person.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line(d.values); })
      .style("stroke", function(d) { return color(d.name); });

  person.append("text")
	  .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
	  .attr("transform", function(d) { return "translate(" + x(d.value.date) + "," + y(d.value.count) + ")"; })
	  .attr("x", 3)
	  .attr("dy", ".35em")
	  .text(function(d) { return d.name; });
}
