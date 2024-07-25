


import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { Component } from 'vue';
import { convertUrlToPath, createFolderByUrl, delayFileExistsByUrl, getResMeta, stringCase } from '../../utils';
import { existsSync } from 'fs';

function getComScript(name = 'NewClass',scene="GameScene") {
    
    let temp = `
    import { MVVM } from "@core/mvvm/MVVM";
    import { GameBase, GameMode } from "@framework/GameBase";

export class ${name} extends GameBase {

    public dataModel = new MVVM({ step: 0 });
    dependScene = "${scene}";
    /**
    * 初始化数据层、监听事件等
    * 
    */
    public onInit() {

    }
    public onData(params: any): void {
        
    }
    /**
     * 进入游戏，可以是切换cocos的scene或者用guiscene切换
     * @param next 
     */
    public onEnter( next: (args) => void) {

        next({});
    }

    /**
     * 退出游戏
     * @param next 
     */
    public onExit(next: (args) => void) {

        next({});
    }

}
    `

    return temp
}


function getWechatSubpackageMetaUserData() {
    return {
        "compressionType": {
        "wechatgame": "subpackage"
        },
        "isRemoteBundle": {
        "wechatgame": false
        },
        "isBundle": true,
    };
}



let comp:Component = 
{
    template: readFileSync(join(__dirname, '../../../static/template/vue/create-project.html'), 'utf-8'),
	data() {
		return {
			inputName: '',
            inputSceneName: '',
            display: '',
            showLoading: false
		};
	},
	methods: {
		onChangeTypeSelect(index: string) {
            this.typeSelectIndex = Number(index);
        },
        async onClickCreate() {
            const name = stringCase(this.inputName);
            const dependScene = this.inputSceneName;
            const folderPath = `db://assets/${name}`;

            // if (/^[a-z][a-z0-9-]*[a-z0-9]+$/.test(name) === false) {
            //     this.display = '[错误] 名字不合法\n1、不能以数字开头\n2、不能以分隔符开头或结尾';
            //     return;
            // }
            if (name === 'all') {
                this.display = '[错误] 名字不合法\n1、不能使用all作为名字';
                return;
            }


            const baseScriptUrl = `${folderPath}/scripts/${name}.ts`;


            // 创建前确认
            const createResponse = await Editor.Dialog.info(`请确认:项目${name},dependScene:${dependScene}`, { detail: name, buttons: ['创建并打开', '仅创建', '取消'], default: 0, cancel: 2 });
            if (createResponse.response == 2) {
                this.display = 'createResponse';
                return;
            }
         
            this.display = '创建中';
            this.showLoading = true;

            // 创建目录
            if (!await createFolderByUrl(folderPath, { subPaths: [ 'scripts', 'scripts/views','res'] })) {
                this.showLoading = false;
                this.display = `[错误] 创建目录失败\n${folderPath}`;
                return;
            }

            // // 设置native分包
            await delayFileExistsByUrl(`${folderPath}.meta`);
            const queryNativeMeta = await Editor.Message.request('asset-db', 'query-asset-meta', folderPath).catch(_ => null);
            if (!queryNativeMeta) {
                this.showLoading = false;
                this.display = '[错误] 设置native分包配置失败';
                return;
            }
            queryNativeMeta.userData = getWechatSubpackageMetaUserData();
            await Editor.Message.request('asset-db', 'save-asset-meta', folderPath, JSON.stringify(queryNativeMeta)).catch(_ => null);
            
            // 创建script
            if (!existsSync(convertUrlToPath(baseScriptUrl))) {
                const createScriptResult = await Editor.Message.request('asset-db', 'create-asset', baseScriptUrl, getComScript(name,dependScene)).catch(_ => null);
                if (!createScriptResult) {
                    this.showLoading = false;
                    this.display = `[错误] 创建脚本失败\n${baseScriptUrl}`;
                    return;
                }
            }

            this.showLoading = false;
            this.display = `[成功] 创建成功\n${folderPath}`;

            // 是否打开
            if (createResponse.response == 0) {
                Editor.Message.request('asset-db', 'open-asset', baseScriptUrl);
            }         
        }
	},
	
	watch: {},
	created() {},
	mounted() {
		console.log("Mount componens")
	},
}

export default comp;