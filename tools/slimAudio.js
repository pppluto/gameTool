const ps = require('path');
const { exec } = require('child_process');

(async () => {
    const inputPath = ps.join(__dirname, '.', 'yfpx_bgm_game.mp3');
    const outPath = ps.join(__dirname, '.', 'dest.mp3');

    let cmd = `ffmpeg -i ${inputPath} -b:a 128k ${outPath}`;

    exec(cmd, ['dist'], (error, stdout, stderr) => {
        if (error) {
            console.log('Error in removing files', error);
            return;
        }
        if (stderr) {
            console.log('an error with file system', stderr);
        }
        console.log(stdout);
    });
})();
