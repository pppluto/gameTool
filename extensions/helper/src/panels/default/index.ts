import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { createApp, App } from 'vue';
import createProject from '../components/create-project';
import createScript from '../components/create-script';

const panelDataMap = new WeakMap<any, App>();


/**
 * @zh 如果希望兼容 3.3 之前的版本可以使用下方的代码
 * @en You can add the code below if you want compatibility with versions prior to 3.3
 */
// Editor.Panel.define = Editor.Panel.define || function(options: any) { return options }
module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('show'); },
        hide() { console.log('hide'); },
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app',
        text: '#text',
    },
    methods: {
        hello() {
            if (this.$.text) {
                this.$.text.innerHTML = 'hello';
                console.log('[cocos-panel-html.default]: hello');
            }
        },
    },
    ready() {
        if (this.$.text) {
            this.$.text.innerHTML = 'Hello Cocos.';
        }
        if (this.$.app) {
            const app = createApp({
                data(){
                    return {
                        tabIndex:0
                    }
                }
            });
            app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('ui-');
            app.component('MyHome', {
                template: readFileSync(join(__dirname, '../../../static/template/vue/home.html'), 'utf-8'),
                data() {
                    return {
                        menus: ['View', 'Manager', 'Controller', 'Model', 'Sound', '资源目录'],
                        index:0,
                        menuComps:[createProject,createScript],
                        content: createProject
                    };
                }, methods: {
                    onClick(index:number){
                        this.index = index
                        this.content = this.menuComps[index]
                    }
                  
                },
            });
           
            app.mount(this.$.app);
            panelDataMap.set(this, app);
        }
    },
    beforeClose() { },
    close() {
        const app = panelDataMap.get(this);
        if (app) {
            app.unmount();
        }
    },
});
