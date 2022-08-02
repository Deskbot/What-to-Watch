import * as minimist from "minimist"
import { once } from "./util"

const defaultRateLimit = 3

export const getArgs = once(() => minimist(process.argv.slice(2)))
