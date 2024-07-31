const fs = require('fs');
const ps = require('path');
const { exec } = require('child_process');

(async () => {
    const dirPath = ps.join(__dirname, '.', 'text.json');
    const dir2Path = ps.join(__dirname, '.', 'alltxt.txt');

    const mapJsonStr = await fs.readFileSync(dirPath, 'utf-8');

    const zhobj = JSON.parse(mapJsonStr);

    let finalObj = {};

    let str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.?!@#$%*()解锁用户协议《隐私保护指引》';

    const excuateFont = (str, fontpath, destPath) => {
        let toolpath = ps.join(__dirname, 'sfnttool.jar');

        exec(`java -jar ${toolpath} -s ${str} ${fontpath} ${destPath}`, ['dist'], (error, stdout, stderr) => {
            if (error) {
                console.log('Error in removing files', error);
                return;
            }
            if (stderr) {
                console.log('an error with file system', stderr);
            }
            console.log(stdout);
        });
    };

    let alFont = ps.join(__dirname, 'ALIBABA-PUHUITI-BOLD.TTF');
    let alTarget = ps.join(__dirname, '..', 'assets/resources/MHFZDResources/fonts/ALIBABA-PUHUITI-BOLD.TTF');

    excuateFont(str, alFont, alTarget);

    zhobj.forEach((v) => {
        str += v.textContent;
        finalObj[v.textId] = v.textContent;
    });

    await fs.writeFileSync(dir2Path, str);
    let zhPath = ps.join(__dirname, '..', 'assets/resources/MHFZDResources/language/text/zh.json');
    await fs.writeFileSync(zhPath, JSON.stringify(finalObj));

    // return;

    let fontpath = ps.join(__dirname, 'hanyisongyunlanghei.ttf');

    let targetPath = ps.join(__dirname, '..', 'assets/resources/MHFZDResources/fonts/hanyisongyunlanghei.ttf');

    excuateFont(str, fontpath, targetPath);
})();
