"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
let comp = {
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/vue/counter.html'), 'utf-8'),
    data() {
        return {
            counter: 0
        };
    },
    methods: {},
    watch: {},
    created() { },
    mounted() {
        console.log("Mount componens");
    },
};
exports.default = comp;
