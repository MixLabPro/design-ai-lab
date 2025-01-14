// 为了减少u2net在实验过程中的重复加载，耗时

const Yolov5 = require('./yolov5');
const U2net = require('./u2net');
const Mobilenet = require('./mobilenet');


const u2net = new U2net();
const yolo = new Yolov5();
yolo.load();

const mobilenet = new Mobilenet();
mobilenet.init();

async function u2netDrawSegment(base64) {
    let im = await createImage(base64);
    let canvas = await u2net.drawSegment(im);
    return canvas.toDataURL();
}

async function yoloDetectAndBox(base64) {
    let im = await createImage(base64);
    let res = await yolo.detectAndBox(im);
    return res;
}

async function mobilenetClassify(base64) {
    let im = await createImage(base64);
    return mobilenet.classify(im);
}
async function mobilenetInfer(base64) {
    let im = await createImage(base64);
    return mobilenet.infer(im);
}

function createImage(url) {
    return new Promise((resolve, reject) => {
        let _img = new Image();
        _img.src = url;
        _img.onload = function() {
            resolve(_img);
        }
    })
};