import * as fs from "fs"
import * as process from "process"
import { stdout } from "process"
import * as readline from "readline"
import { getArgs } from "./args"
import { csvHeaderRow, getCsv, getJson } from "./output"

try {
    main()
} catch (err) {
    console.error(err)
    process.exit(1)
}

function main() {
    const args = getArgs()

    if (args["h"] || args["help"]) {
        return printHelp()
    }

    if (args["readme"]) {
        return printReadme()
    }

    const csv = !args["json"] // default to CSV

    // choose where to take the input from
    const file = args._[0] as string | undefined // first arg
    const input = readline.createInterface(
        file
            ? fs.createReadStream(file)
            : process.stdin
    )

    // generate and write out the result
    if (csv) {
        writeCsv(input, getCsv)
    } else {
        writeJson(input, getJson)
    }
}

function printHelp() {
    console.log("Usage: command (file path)? (arguments)*")
    console.log("")
    console.log("If a file is given, the file will be used as input, otherwise stdin is used.")
    console.log("")
    console.log("Input format: movie titles on separate lines")
    console.log("")
    console.log("Arguments:")
    console.log("-h | --help      : Print help.")
    console.log("--readme         : Print the readme.")
    console.log("--json           : Output in JSON format (instead of CSV).")
    console.log("--rate-limit     : Set the maximum number of movies that can be queried simultaneously. If set too high, queries will be rejected by the websites queried. (default: 5)")
}

function printReadme() {
    fs.createReadStream(__dirname + "/../README.md")
        .pipe(process.stdout)
}

function writeCsv(input: readline.Interface, getMovieInfo: (movie: string) => Promise<string>) {
    // write headers
    console.log(csvHeaderRow)

    // write main rows
    input.on("line", movie => {
        movie = movie.trim()
        if (movie.length === 0) return undefined

        getMovieInfo(movie).then(console.log)
    })
}

function writeJson(input: readline.Interface, getMovieInfo: (movie: string) => Promise<string>) {
    stdout.write("[")

    const lines = [] as Promise<void>[]
    let firstLine = true

    // write out one object at a time
    input.on("line", movie => {
        movie = movie.trim()
        if (movie.length === 0) return

        const writeResult = async () => {
            const obj = await getMovieInfo(movie)

            // should be a comma before each object except the first
            if (!firstLine) {
                stdout.write(",")
                firstLine = false
            }

            stdout.write(obj)
        }

        lines.push(writeResult())
    })

    input.on("close", async () => {
        // ensure that the closing brace comes last
        await Promise.all(lines)
        stdout.write("]")
    })
}
