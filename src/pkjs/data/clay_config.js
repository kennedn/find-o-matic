module.exports = 
 [
  {
    "type": "heading",
    "defaultValue": "find-o-matic",
    "id": "JSONHeading"
  },
  {
    "type": "text",
    "defaultValue": "<a href='https://github.com/kennedn/find-o-matic'><img src='https://shields.io/badge/github-Source%20Code-white?logo=github&style=for-the-badge' alt='Source Code'></img></a>",
    "id": "MainText"
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Search",
        "id": "SearchHeading",
      },
      {
        "type": "input",
        "id": "SearchInput",
        "label": "<font style='color:#ff4700;'>* </font>Search terms",
        "attributes": {
          "autocapitalize": "off",
          "autocorrect": "off",
          "autocomplete": "off",
          "type": "search",
          "spellcheck": false,
          "required": true
        }
      },
      {
        "type": "text",
        "id": "SearchText",
        "defaultValue": ""
      },
      {
        "type": "button",
        "id": "SearchButton",
        "defaultValue": "Submit",
        "description": "Select a destination to track exclusively, otherwise find-o-matic tracks the closest destination relative to your position",
        "primary": true,
      },
      {
        "type": "input",
        "messageKey": "ClayJSON",
        "id": "ClayJSON",
        "attributes": {
          "type": "text",
          "style": "display: none;"
        }
      },
    ]
  },
  {
    "type": "text",
    "defaultValue": "Made by <a href='https://kennedn.com'>kennedn</a></br>&nbsp;",
    "id": "MadeByText"
  },
];
