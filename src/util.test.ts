import { ok, strictEqual } from "assert"
import * as util from "./util"
import { Test, TestSuite } from "testyts"

@TestSuite()
export class UtilSuite {
    @Test()
    average() {
        ok(Number.isNaN(util.average([])))
        strictEqual(util.average([1]), 1)
        strictEqual(util.average([1,3]), 2)
    }

    @Test()
    escapeDoubleQuotes() {
        strictEqual(util.escapeDoubleQuotes('',    '""'), '')
        strictEqual(util.escapeDoubleQuotes('str', '""'), 'str')
        strictEqual(util.escapeDoubleQuotes('"',   '""'), '""')
        strictEqual(util.escapeDoubleQuotes('""',  '""'), '""""')
    }

    @Test()
    getHighest() {
        const isLeftBigger = (n1: number, n2: number) => n1 - n2

        strictEqual(util.getHighest([], isLeftBigger), undefined)
        strictEqual(util.getHighest([2], isLeftBigger), 2)
        strictEqual(util.getHighest([3,1,2], isLeftBigger), 3)
    }
}
