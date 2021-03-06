This is the protocol supported by the backend.

Queries format
==============

A query is a JSON object with the following format:
	{
		"constraints": /* dictionary of constraints keyed by ID */,
		"views": /* dictionary of views keyed by ID */
	}

A response is a dictionary of results keyed by view ID. The value for each ID is the result for the corresponding view. Each result is a JSON structure, with the details depending on the view. The results are based only on the events in the data which match all of the constraints.

Years are given as integers, where negative indicates BCE and positive indicates CE.

Some view types are paginated (see the code and the design notes below for details) or can optionally be paginated. These views have a page attribute which sets the page number, starting from zero. The number of items per page is determined by the backend. The result contains details for this number of events, or as many are available to match the constraints if less than a full page is available. The result also has a "more" attribute indicating whether more pages are available. Submitting a query with the same constraints and the same view except for a changed page number will fetch subsequent pages. If a view type is strictly paginated then it will assume a page number of zero if no page number is given. If it is optionally paginated it will paginate only if a page number is given, and otherwise will return all possible results. If a page number past the last page is requested then the result will be properly structured and have the "more" attribute set to false, but the contents are otherwise undefined.

Any view result can have an error; see below.

See examplequeries/ for examples.

Fields
======

The following fields can be used for field constraints and views (described below):

- predicate: The verb the roles apply to.
- location: List of location keywords.
- currentcountry: List of current country keywords.
- person: List of person keywords.
- category: List of category keywords.
- description: Text description of the event. 
- roleA0, roleA1, etc.: The role values for the event.
- role: The roleA0, roleA1, etc. field values as a single keyword listr

The index also contains fields for date and reference points, but these have their own specific constraints and views.

Constraints
===========

For details see queries.py, especially constraint_to_sdb_query().

### Constrain to events where a field has a particular value:
	{
		"type": "fieldvalue",
		"field": /* name of field to match */,
		"value": /* value for the field to match */
	}

### Constrain to events that match a free text search on one or more fields:
	{
		"type": "textsearch",
		"value": /* search term in Whoosh's text format */
	}

### Constrain to events in an time range (inclusive):
	{
		"type": "timerange",
		"low": /* lower bound year (inclusive, and see year format above) */,
		"high": /* upper bound year (inclusive, and see year format above) */
	}

### Constrain to events in particular reference points:
	{
		"type": "referencepoints",
		"points": /* list of reference points to match */
	}

Views and results
=================

For details see queries.py, especially generate_views().

### Get counts of events by value of a particular field:
	{
		"type": "countbyfieldvalue",
		"field": /* name of field to count on */,
		"page": /* optional; page number, defaults to 0 if not given */
	}
result:
	{
		"counts": /* list of count pairs, each of which is a value and an integer count */,
		"more": /* boolean flag indicating if there are more pages available */
	}
This view is always paginated.

### Get counts of events by map reference point:
	{
		"type": "countbyreferencepoint",
		"page": /* optional; page number, no pagination if not given */
	}
result:
	{
		"counts": /* list of count pairs, each of which is a value and an integer count */,
		"more": /* boolean flag indicating if there are more pages available, set only if pagination is enabled */
	}
This view is optionally paginated.

### Get links between reference points:
	{
		"type": "referencepointlinks",
		"page": /* optional; page number, no pagination if not given */
	}
result:
	{
		"links": /* list of link details */,
		"more": /* boolean flag indicating if there are more pages available, set only if pagination is enabled */
	}
where each element corresponds to a link between two distinct reference points and has the format:
	{
		"refpoints": /* list containing two distinct reference point values (order insignificant) */,
		"count": /* integer number of events that are in both reference points */
	}
Note that links are undirected, so any two distinct reference points will have at most one link element. This view is optionally paginated.

### Get counts of events by year:
	{
		"type": "countbyyear",
		"page": /* optional; page number, no pagination if not given */
	}
result:
	{
		"counts": /* list of count pairs, each of which is a value and an integer count */,
		"more": /* boolean flag indicating if there are more pages available, set only if pagination is enabled */
	}
This view is optionally paginated.

### Get descriptive details of events:
	{
		"type": "descriptions",
		"page": /* optional; page number, defaults to 0 if not given */
	}
result:
	{
		"descriptions": /* list of event details */,
		"more": /* boolean flag indicating if there are more pages available for this view */
	}
where each element corresponds to a particular event and has the format:
	{
		"year": /* year (see year format above) */,
		"descriptionHtml": /* HTML-formatted description */
	}
This view is always paginated.

### Get grouped occurrences of entities (field name and value pairs) over time
	{
		"type": "plottimeline",
		"clusterField": /* field name to group entities on per year */,
		"cooccurrences": /* optional; method "and" or "or" of finding co-occurring entities */,
		"cooccurrenceFields": /* optional but must be set of "cooccurrences" is; names of fields to find co-occurring entities on */,
		"entities": /* entity specification */
	}
where the entity specification is a structure keyed on field names, where each value is a list of corresponding field values, as follows:
	"entities": {
		"fieldname1": [
			"fieldvalue1",
			"fieldvalue2",
			/* ... */
		],
		"fieldname2": [ /* ... */ ],
		/* ... */
	}
Result:
	{
		"numCooccurringEntities: /* only included if "cooccurrences" set in query; total number of co-occurring entities */,
		"numIncludedCooccurringEntities: /* only included if "cooccurrences" set in query; number of co-occurring entities included in result */,
		"timeline": /* timeline table */
	}
where the timeline table is:
	{
		"fieldname1": {
			"fieldvalue1" {
				"year1": [
					"clustervalue1",
					"clustervalue2",
					/* ... */
				],
				"year2": [ /* ... */ ],
				/* ... */
			},
			"fieldvalue2" { /* ... */ },
			/* ... */
		},
		"fieldname2": { /* ... */ },
		/* ... */
	}
The result indicates for each entity (field name and value) which cluster values (the values of the field to group on) the entity occurs with for each year. Only years where the entity occurs with some cluster value are included. If "cooccurrences" is set in the query, the result also includes extra entities using the field names from "cooccurrenceFields" which co-occur with the specified entities and any cluster value; if cooccurrences is "or" co-occurrences with any of the specified entities are included, while if it is "and" only co-occurrences with all of the specified entities together are included.

Errors
======

Any view result can be replaced by an error if an error occurred when handling that view. The error could be intended if the backend refuses to handle a certain constraint, or could indicate an internal backend error. An error result has the format:
	{
		"error": /* true boolean error message string */
	}
The value of the error attribute is either a boolean true value if there is no specific error message, or a string containing a specific error message.
