"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
exports.default = {
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/vue/create-project.html'), 'utf-8'),
    methods: {
        async click_scene_script() {
            // const result = await Editor.Message.request("scene", "execute-scene-script", {
            // 	name: config.name_s,
            // 	method: "event_template",
            // 	args: [1],
            // });
            // console.log("场景脚本返回", result);
        },
    },
    data() {
        return {};
    },
    watch: {},
    created() { },
    mounted() {
        console.log("Mount componens");
    },
};
