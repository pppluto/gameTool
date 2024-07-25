


import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { Component } from 'vue';

let comp:Component = 
{
    template: readFileSync(join(__dirname, '../../../static/template/vue/create-script.html'), 'utf-8'),
	data() {
		return {
			inputName: '',
            display: '',
            showLoading: false
		};
	},
	methods: {
		async onClickCreate() {

      
		}
	},
	
	watch: {},
	created() {},
	mounted() {
		console.log("Mount componens")
	},
}

export default comp;