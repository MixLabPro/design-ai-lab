const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-webgl');

const internalIp = require('internal-ip');
const host = internalIp.v4.sync();

// u2net
class U2net {
    constructor(progressFn) {
        this.url = `http://${host}/u2net/model.json`;

        let model = tf.loadGraphModel(this.url, {
            onProgress: function (progress) {
                let info = { type: "load_progress", progress: progress * 100 };
                console.log(info);
                if (progressFn) progressFn(info)
            }
        });
        model.then((res) => {
            this.model = res;
            const warmupResult = this.model.predict(tf.zeros([1, 3, 320, 320]));
            warmupResult.forEach((i) => i.dataSync());
            warmupResult.forEach((i) => i.dispose());
            let info = { type: "load_model_done", backend: tf.getBackend() };
            console.log(info);
            this.ready=true;
            if (progressFn) progressFn(info)
        });
    }

    predict(originalImageElement) {
        if(!this.ready) setTimeout(()=>{
            this.predict(originalImageElement);
        })
        let ori_tf = tf.browser.fromPixels(originalImageElement);
        // console.log(ori_tf)
        let resizedImage = ori_tf.resizeNearestNeighbor([320, 320]).toFloat().div(tf.scalar(255));
        let adj = resizedImage.div(resizedImage.max()).sub(tf.scalar(0.485)).div(tf.scalar(0.229));
        let finalInput = adj.transpose([2, 0, 1]).expandDims(0);

        // console.log(finalInput.arraySync());
        let preds = this.model.predict(finalInput);
        // preds = Array.from(preds, p => p.dataSync());


        let pred = preds[0];
        var pred_max = pred.max();
        var pred_min = pred.min();
        pred = pred.sub(pred_min).div(pred_max.sub(pred_min));
        pred = pred.squeeze();
        pred = pred.reshape([320, 320]);

        // pred=pred.mul(tf.scalar(255));
        // console.log(pred)
        // pred = pred.resizeNearestNeighbor([ori_tf.shape[0], ori_tf.shape[1]]);
        // console.log(pred.arraySync());
        return new Promise((resolve, reject) => {

            resolve(pred.arraySync());
            pred.dispose();
            ori_tf.dispose();
            resizedImage.dispose();
            adj.dispose();
            finalInput.dispose();
            preds.forEach((i) => i.dispose());

        });
    }

    async drawSegment(originalImageElement) {
        let maskMap =await this.predict(originalImageElement);
        // console.log(maskMap)
        let mask_canvas = document.createElement('canvas');
        await tf.browser.toPixels(tf.tensor(maskMap), mask_canvas);

        let img = tf.browser.fromPixels(originalImageElement);
        let canvas = document.createElement('canvas');
        await tf.browser.toPixels(img, canvas);
        canvas.className='opacity-background';
        
        let ctx=canvas.getContext('2d');
        ctx.globalCompositeOperation='destination-in';
        
        // mask的透明度处理
        let imageData = mask_canvas.getContext('2d').getImageData(0, 0, mask_canvas.width, mask_canvas.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            // 根据白色的数值来决定透明度   
            imageData.data[i + 3] = parseInt((imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3);
        };
        mask_canvas.getContext('2d').putImageData(imageData, 0, 0);
        
        ctx.drawImage(mask_canvas,0,0,mask_canvas.width,mask_canvas.height,0,0,canvas.width,canvas.height);

        return canvas
    }
}

module.exports =  U2net;