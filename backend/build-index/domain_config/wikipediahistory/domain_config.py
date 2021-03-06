"""
Configuration for the data domain; how to index and otherwise handle data.

If making only local changes, don't alter the default data domain configuration;
see the readme for more information.
"""

import wikipediahistory

settings = {
  'querier': {
    'fields_to_prime': ['role', 'predicate', 'event', 'year'] + wikipediahistory.facet_field_names,
    'fields_for_text_searches': ['description', 'role', 'predicate', 'event', 'year'] + wikipediahistory.facet_field_names
  }
}

# Number of role argument fields.
num_role_arguments = 6

# List of names for extra keyword fields (especially for facets).
extra_keyword_field_names = wikipediahistory.facet_field_names

# List of fields to send for description results.
description_field_names = wikipediahistory.description_field_names

# List of functions to provide values for an event document given Json data for the event. Each function should return a dict-like object that provides any number of field names and values. Value can be non-unicode strings, numeric values, or iterables (for multiple keyword values), all of which will be converted to appropriate values for whoosh. The functions are applied in order. Together they should set at least all the required fields except for id.
value_getters = [
  wikipediahistory.get_required_field_values(num_role_arguments),
  wikipediahistory.get_facet_field_values
]

# Alias field names. Function mapping alias names to real names.
field_name_aliases = wikipediahistory.field_name_aliases
