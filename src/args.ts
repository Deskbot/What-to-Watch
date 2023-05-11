import * as minimist from "minimist"
import { once } from "./util"

const defaultRateLimit = 4

export const getArgs = once(() => minimist(process.argv.slice(2)))

export const getRateLimit = once(() => parseInt(getArgs()["rate-limit"]) || defaultRateLimit)
