//lab提供封装好的功能


const ColorThief = require('colorthief/dist/color-thief.umd');
const colorThief = new ColorThief();

const ffmpeg = require('./ffmpeg');

class Base {
    constructor() {}
    createTextImage(txt, fontSize = 24, color = "black", width = 300) {
        let canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');
        let x = 2;
        // canvas.width = 480;
        // canvas.height = 32;
        ctx.font = `${fontSize*x}px Arial`;
        let font = ctx.measureText(txt);
        canvas.height = (font.fontBoundingBoxAscent + font.fontBoundingBoxDescent) + 12;
        canvas.width = (font.width) + 10;

        ctx.fillStyle = color;
        ctx.textAlign = "start";
        ctx.textBaseline = "top";
        ctx.font = `${fontSize*x}px Arial`;
        ctx.fillText(txt, 5, 10);

        let base64, height;

        if (canvas.width > width) {
            let nc = document.createElement('canvas'),
                nctx = nc.getContext('2d');
            nc.width = width;
            nc.height = parseInt(canvas.height * width / canvas.width) + 1;
            nctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, nc.height);
            base64 = nc.toDataURL('image/png');
            height = nc.height;
        } else {
            base64 = canvas.toDataURL('image/png');
            height = canvas.height;
        }

        return { base64, width: width, height: height }
    }
    createImage(url) {
        return new Promise((resolve, reject) => {
            let _img = new Image();
            _img.src = url;
            _img.onload = function() {
                resolve(_img);
            }
        })
    }
}

class AI {
    constructor() {}
    cropCanvas(_canvas, x, y, w, h) {
        let scale = _canvas.canvas.width / _canvas.width;
        let canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(_canvas.canvas, x * scale, y * scale, w * scale, h * scale, 0, 0, w * scale, h * scale);
        return canvas
    }
    getColor(_img) {
        let _im = _img.elt;
        if (_im.complete) {
            _img.mainColor = color(...colorThief.getColor(_im));
        } else {
            _im.addEventListener('load', function() {
                _img.mainColor = color(...colorThief.getColor(_im));
            });
        }
    };

    getPalette(_img) {
        let _im = _img.elt;
        if (_im.complete) {
            _img.colorPalette = Array.from(colorThief.getPalette(_im), c => color(...c));
        } else {
            _im.addEventListener('load', function() {
                _img.colorPalette = Array.from(colorThief.getPalette(_im), c => color(...c));
            });
        }
    }

    loadface(_img) {
        let _im = _img.elt;
        var faceDetector = new FaceDetector({ fastMode: false, maxDetectedFaces: 10 });
        _img.faces = [];
        faceDetector.detect(_im).then(function(faces) {
            console.log(`人脸检测`, faces)
            faces.forEach(function(item) {

                _img.faces.push({
                    x: parseInt(item.boundingBox.x),
                    y: parseInt(item.boundingBox.y),
                    width: parseInt(item.boundingBox.width),
                    height: parseInt(item.boundingBox.height)
                });
            });
        }).catch(function(err) {
            console.log("err", err)
        });
    };

    loadtext(_img) {
        let _im = _img.elt;
        let textDetector = new TextDetector();
        _img.textBlocks = [];
        textDetector.detect(_im)
            .then(detectedTextBlocks => {
                console.log(`文本检测`, detectedTextBlocks)
                for (const textBlock of detectedTextBlocks) {
                    _img.textBlocks.push({
                        x: textBlock.boundingBox.x,
                        y: textBlock.boundingBox.y,
                        width: textBlock.boundingBox.width,
                        height: textBlock.boundingBox.height
                    });
                }
            }).catch(() => {
                console.error("Text Detection failed, boo.");
            })
    }
}



module.exports = {
    ai: new AI(),
    base: new Base(),
    video: ffmpeg
};