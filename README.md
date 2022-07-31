# What-to-Watch

This program takes a list of movie names and outputs their scores given by various websites and how long it takes to beat the movie.

Data is collected from:

* howlongtobeat.com
* gog.com
* metacritic.com
* steampowered.com

The output format is either of:

* [CSV](https://en.wikipedia.org/wiki/Comma-separated_values) (default) (compatible with popular spreadsheet software)
* [JSON](https://en.wikipedia.org/wiki/JSON)

This program can be used:

* on the command line reading from stdin or a file;
* as an npm package.

You can specify the gaming platforms you use to improve score relevancy, and you can improve search results by specifying your country.

## Prerequisites

* Install [NodeJS](https://nodejs.org/en/).
* Install [NPM](https://www.npmjs.com/).

If you're a non-technical person looking at this, I'm sorry. This code won't run in a browser due to browser security preventing requests between websites. Although I could set something up on a server and have all the data downloaded on the server side, it would be too slow with multiple concurrent users due to the way these websites prevent spam by blocking too many requests from a single origin.

## How to Run

Run without install:

```
npx what-to-watch ...
```

Global install:

```
sudo npm install --global what-to-watch
what-to-watch ...
```

Dependency:

```
npm install what-to-watch
npx what-to-watch ...
```

From source:

```
git clone https://github.com/Deskbot/what-to-watch --depth 1
cd what-to-watch
npm install
npm run build
npm run main -- ...
```

### Arguments

```
Usage: command (file path)? (arguments)*

If a file is given, the file will be used as input, otherwise stdin is used.

Input format: movie titles on separate lines

Arguments:
-h | --help      : Print help.
--readme         : Print the readme.
--json           : Output in JSON format (instead of CSV).
--rate-limit     : Set the maximum number of movies that can be queried simultaneously. If set too high, queries will be rejected by the websites queried. (defaults to 3)
```

e.g. `what-to-watch list_of_movies.txt --json`

## Library Usage

See `src/api.ts` for what exactly is available.

The main functions to look at are in `src/output.ts`. Functions for getting a subset of the output data are exposed under namespaces in `src/api.ts`.

In terms of API stability. You can trust exports from `src/output.ts` to be less likely to change than other exports, but I'll try to keep to semantic versioning.

This package depends on NodeJS libraries. It won't run in browser due to [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) policy implemented by browsers.

## Output

The default format is [CSV](https://en.wikipedia.org/wiki/Comma-separated_values).

The scores are reported the same as on the website the score came from, they are not normalised to be out of the same possible maximum.

The CSV columns and JSON fields are pretty self-explanatory and may change over time, so they are not specified here.

The output includes the title of the movie as interpreted by each website. You should check this to be sure that the information you're seeing is actually for the given movie.

For various reasons, a movie or score might not be found from the website. As a CSV, this leaves an empty field. In JSON, the field is not present.

### Understanding the Numbers

| Number                         | Maximum |
| ------------------------------ | ------- |
| Metacritic Critic Score        | 100     |
| Metacritic User Score          | 10      |
| IMDB Score                     | 10      |
| Rotten Tomatoes Critic Score   | 100     |
| Rotten Tomatoes Audience Score | 100     |

The aggregate score exists so that there will be a score column filled in for every row for ease of sorting. However, doing this will skew movies that exist on Steam further to the top because Steam's review system means it yields scores closer to 100.

### Shortcomings

Movies with similar names could be confused for one another. An effort has been made to choose the best search result offered by each website, which is more accurate than taking the top result.

The movie found by each website is included in the output so you know whether the score displayed is for the movie you're looking for.

When there are multiple equally good matches, it is assumed that you are searching for the best one.

There are often multiple movies with the same name released in different years. If you include the year at the end of your input, it will be factored into the results.

### Format Differences

The JSON output has fields for hyperlinks to where the data came from. In the CSV output, these urls are encoded as hyperlinks in the cell containing the related data.

The hyperlinks are encoded as `=HYPERLINK("url","label")`, which is a valid formula with the same behaviour across Libre Office Calc, Google Sheets, and Microsoft Office Excel, and probably several others.

## Rate Limiting

Your requests are rate limited to prevent the websites rejecting you and causing a timeout.

## Privacy

Be aware that by running the software, you may be subject to aspects of the privacy policies of the websites visited. The websites that could be visited are listed above.

This program does not send any cookies to those sites and scripts on the queried web pages are never executed. So it is not the same as if you were to visit these sites manually.

## License

The license is a slightly modified version of the MIT license to require that you to provide a notice about privacy like the one above.
