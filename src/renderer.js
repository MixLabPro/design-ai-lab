// 渲染进程
const { ipcRenderer, remote } = require("electron");
const md5 = require('md5');
const fs = require("fs");
const timeago=require('timeago.js');
const Muuri=require("muuri");
// console.log(timeago)

const Knowledge = require("./knowledge");
const Editor = require("./editor");
const Rewrite = require("./rewrite");
const db = require('./db');
const Log=require('./log');
// const { read } = require("jimp");
// const ffmpeg=require('./ffmpeg');


(() => {
        //改写代码
        //TODO 错误捕捉
        const rewrite = new Rewrite(["setup", "draw"]);

        //编辑器
        let previewWindow = null,
            mainWindow = null;

        const editor = new Editor(
                document.querySelector("#editor"),
                localStorage.getItem("code"),
                (code) => {
                    previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
                    //const code=this.editor.getValue();

                    //检查编辑器 写的代码 本身的错误
                    let isError = false;
                    try {
                        new Function(code.trim())();
                    } catch (error) {
                        //console.log(error)
                        Log.add(error);
                        isError = true;
                    };

                    // // console.log(code)
                    // try {
                    //     code = rewrite.create(code.trim());
                    // } catch (error) {
                    //     //console.log(error)
                    //     Log.add(error);
                    // }

                    // previewWindow.webContents.executeJavaScript(`

                    //     try {
                    //         if (p5.instance) { p5.instance.remove() };
                    //         document.querySelector("#p5").innerHTML = "";
                    //         ${code.trim()};
                    //         new p5(null, 'p5');
                    //         ipcRenderer.sendTo(mainWindow.webContents.id, 'executeJavaScript-result','success');
                    //     } catch (error) {
                    //         console.log(error);
                    //         ipcRenderer.sendTo(mainWindow.webContents.id, 'executeJavaScript-result',error);
                    //     };

                    //     `, false)
                    //     .then((result) => {
                    //         //console.log("成功", result)
                    //         // editorElement.classList.remove("ui-error");
                    //         // editorElement.classList.add("ui-success");
                    //     }).catch(err => {
                    //         Log.add(err)
                    //             // console.log("失败")
                    //             // editorElement.classList.add("ui-error");
                    //             // editorElement.classList.remove("ui-success");
                    //     });

                    if (isError) return;

                    let preRun = ['preload', 'setup', 'draw'];

                    previewWindow.webContents.executeJavaScript(`
                try {
                    if (p5.instance) { p5.instance.remove() };
                    document.querySelector("#p5").innerHTML = "";
                    ${code.trim()};
                    new p5(null, 'p5');
                    ${Array.from(preRun,r=>`if(window.${r}) ${r}();`).join("\n")}
                    ipcRenderer.sendTo(mainWindow.webContents.id, 'executeJavaScript-result','success');
                } catch (error) {
                    console.log(error);
                    ipcRenderer.sendTo(mainWindow.webContents.id, 'executeJavaScript-result',error);
                };
                `, false)
                .then((result) => {
                    console.log("executeJavaScript", result)
                        //Log.add('success')
                        // editorElement.classList.remove("ui-error");
                        // editorElement.classList.add("ui-success");
                }).catch(err => {
                    Log.add(err)
                        // console.log("失败")
                        // editorElement.classList.add("ui-error");
                        // editorElement.classList.remove("ui-success");
                });

        }
    );

    const knowledge = new Knowledge(
        document.querySelector("#readme"),
        document.querySelector("#course"),
        localStorage.getItem("knowledge"));

    //获得需要存储的数据
    function getSaveFileContent() {
        return new Promise((resolve,reject)=>{
         //截图
        //  console.log('截图');
        previewWindow=previewWindow||(remote.getGlobal("_WINS")).previewWindow;
        (remote.getGlobal("_WINS")).previewWindow.webContents.capturePage().then(img=>{
            // console.log(img.toDataURL())
            resolve({   
                poster:img.toDataURL(),
                knowledge: knowledge.get(),
                code: editor.getCode(),
                size: previewWindow.getSize()
            })
        });
        });
    }


    // 缓存
    document.querySelector("#course")?.addEventListener("input", e => {
        e.preventDefault();
        localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
    });
    document.querySelector("#readme")?.addEventListener("input", e => {
        e.preventDefault();
        localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
    });


    //GUI
    // 布局
    window.grid=initGrid();
    editor.onMouseUp=function(){
        console.log("onMouseUp",window.grid)
    }
    editor.onMouseDown=function(){
        // grid.destroy();
        // grid=initGrid(false);
        console.log("onMouseDown",window.grid)
    }
    function initGrid(dragEnabled=true) {
        let grid = new Muuri('.grid', {
            dragEnabled: true,
            layoutOnInit: false
        }).on('move', function () {
            saveLayout(grid);
        });

        let layout = window.localStorage.getItem('layout');
        if (layout) {
            loadLayout(grid, layout);
        } else {
            grid.layout(true);
        };

        window.addEventListener('load',()=> grid.refreshItems().layout());

        grid.on('dragReleaseEnd', function (item) {
            console.log(item);
        });

        return grid;
    }

    function serializeLayout(grid) {
        var itemIds = grid.getItems().map(function (item) {
            return item.getElement().getAttribute('data-id');
        });
        return JSON.stringify(itemIds);
    }

    function saveLayout(grid) {
        var layout = serializeLayout(grid);
        window.localStorage.setItem('layout', layout);
    }

    function loadLayout(grid, serializedLayout) {
        var layout = JSON.parse(serializedLayout);
        var currentItems = grid.getItems();
        var currentItemIds = currentItems.map(function (item) {
            return item.getElement().getAttribute('data-id')
        });
        var newItems = [];
        var itemId;
        var itemIndex;

        for (var i = 0; i < layout.length; i++) {
            itemId = layout[i];
            itemIndex = currentItemIds.indexOf(itemId);
            if (itemIndex > -1) {
            newItems.push(currentItems[itemIndex])
            }
        }

        grid.sort(newItems, {layout: 'instant'});
    };



    //ui
    const editFile = document.querySelector("#edit-file"),
        // newFile = document.querySelector("#new-file"),
        // openFile = document.querySelector("#open-file"),
        // saveFile = document.querySelector("#save-file"),
        publicFile = document.querySelector("#public-file");
    const practiceBtn = document.querySelector("#practice-btn");

    function addEventListener(element,fn){
        let isClicked=false;
        element?.addEventListener("click", e => {
            e.preventDefault();
            if(isClicked===true) return;
            isClicked=true;
            fn();
            setTimeout(()=>{
                isClicked=false;
            },500);
        });
    }

    //打开文件
    // addEventListener(openFile,openFileFn);
    //编辑/预览 切换
    addEventListener(editFile,editFileFn);
    //新建
    // addEventListener(newFile,newFileFn);
    //保存
    // addEventListener(saveFile,saveFileFn);
    //发布
    addEventListener(publicFile,pubilcFn);
    //实时编辑代码
    addEventListener(practiceBtn,practiceFn);

    //打开文件
    ipcRenderer.on("open-file",openFileFn);
    //编辑/预览 切换
    ipcRenderer.on("edit-file",editFileFn);
    //新建
    ipcRenderer.on("new-file",newFileFn);
    //保存
    ipcRenderer.on("save-file",saveFileFn);
    //关闭
    ipcRenderer.on("close-file",closeFn);
    //发布
    ipcRenderer.on("public-file",pubilcFn);
   
    //初始状态在 欢迎界面
    window.addEventListener('load',closeFn);

    //显示代码错误
    ipcRenderer.on("executeJavaScript-result", (event, arg) => {
        Log.add(arg);
    });


    function openFileFn(){
        let filePath = remote.dialog.showOpenDialogSync({
            title: "打开……",
            properties: ['openFile'],
            filters: [
                { name: 'Json', extensions: ['json'] }
            ]
        });
        if (filePath) {
            // 
            let res = fs.readFileSync(filePath[0], 'utf-8');
            res = JSON.parse(res);
            knowledge.set(res.knowledge);
            editor.setCode(res.code);
            // saveFile.style.display = "none";
            editFile.style.display = "block";
            // openFile.style.display="none";
            // newFile.style.display = "block";
            knowledge.toggle(true);

            localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
            localStorage.setItem("code", editor.getCode());
            localStorage.removeItem('layout');

            //存至数据库
            db.add(res);

            document.querySelector(".grid").style.display="block";
            document.getElementById("blank-pannel").style.display="none";
            
        };
    }

    function editFileFn(){
        let isReadOnly = knowledge.toggle();
        // console.log(isReadOnly)
        if (!isReadOnly) {
            //编辑状态
            editFile.innerHTML = `<i class="fas fa-toggle-off"></i>`;
            // document.getElementById("knowledge-pannel").classList.remove("knowledge-pannel-small");
            document.getElementById("knowledge-pannel").classList.add("pannel-large");
            grid.destroy();
        } else {
            //预览状态
            editFile.innerHTML = `<i class="fas fa-toggle-on"></i>`;
            document.getElementById("knowledge-pannel").classList.remove("pannel-large");
            grid=initGrid();
        }
        // newFile.style.display = "block";
        // saveFile.style.display = "block";
    }

    function newFileFn(){
        // saveFile.style.display = "block";
        //editFile.style.display = "none";
        // newFile.style.display = "none";
        //编辑状态
        editFile.innerHTML = `<i class="fas fa-toggle-off"></i>`;
        knowledge.toggle(false);
        knowledge.set({
                readme: "",
                course: ""
            })
        //console.log(document.getElementById("editor-pannel"))
        //document.getElementById("editor-pannel").classList.remove("pannel-large");
        editor.setCode('//Hello AI world!');
        localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
        localStorage.setItem("code", editor.getCode());
        localStorage.removeItem('layout');
        grid.destroy();
        grid=initGrid();
        // openPracticeFn();
    }

    function saveFileFn(){
        localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
        localStorage.setItem("code", editor.getCode());

        let filePath = remote.dialog.showSaveDialogSync({
            title: "另存为……",
            defaultPath: `AICODE_${(new Date()).getDay()}.json`
        });
        if (filePath) {
            getSaveFileContent().then(res=>{

                fs.writeFile(filePath, JSON.stringify(res, null, 2), 'utf8', function(err) {
                    if (err) console.error(err);
                    console.log("保存成功");
                    knowledge.toggle(true);
                    // saveFile.style.display = "none";
                    editFile.style.display = "block";
                    // newFile.style.display = "block";
                });
            })
            
        };
        // console.log(filePath)
    }

    function closeFn(){
        // console.log('closeFn')
        document.querySelector(".grid").style.display="none";
        document.getElementById("blank-pannel").style.display="block";

        previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
        mainWindow = mainWindow || (remote.getGlobal("_WINS")).mainWindow;
        if (previewWindow && mainWindow) {
            previewWindow.hide();
            mainWindow.show();
        };
        
        let div=document.createDocumentFragment();
        Array.from(db.getAll(),d=>{
            div.appendChild(createCard(d));
        });
        document.getElementById("recent-files").innerHTML='';
        document.getElementById("recent-files").appendChild(div);
        
    }

    function createCard(data){
        let div=document.createElement('div');
        div.className="card";
        let img=new Image();
        img.src=data.poster;
        div.appendChild(img);
        let readme=document.createElement('h5');
        readme.innerHTML=data.knowledge.readme;
        div.appendChild(readme);

        let t=document.createElement('p');
        readme.innerHTML=data.knowledge.readme;
        timeago.format(data.createDate, 'zh_CN');

        console.log(data)
        return div;
    }

    function practiceFn(){
        let t = editor.toggle();
        if (t === true) {
            document.getElementById("editor-pannel").classList.remove("pannel-large");
            grid=initGrid();
            practiceBtn.innerHTML = `<i class="fas fa-sync"></i>`;
            editor.execute();
            localStorage.setItem("code", editor.getCode());
            editor.format();
        } else {
            //编程模式
            grid.destroy();
            openPracticeFn();
        };
    }

    function openPracticeFn() {
        // document.getElementById("knowledge-pannel").classList.add("knowledge-pannel-small");
        document.getElementById("editor-pannel").classList.add("pannel-large");
        practiceBtn.innerHTML = `<i class="fas fa-sync fa-spin"></i>`;
        
        // grid=initGrid(false);
        previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
        mainWindow = mainWindow || (remote.getGlobal("_WINS")).mainWindow;
        if (previewWindow && mainWindow) {
            previewWindow.show();
            previewWindow.webContents.reload();
            mainWindow.focus();
            previewWindow.webContents.once('dom-ready', () => {
                editor.execute();
                localStorage.setItem("code", editor.getCode());
                editor.format();
            })
        };
    };

    function pubilcFn() {
        editor.toggle(false);
        openPracticeFn();
        mainWindow = mainWindow || (remote.getGlobal("_WINS")).mainWindow;
        mainWindow.hide();
        previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
        previewWindow.setResizable(false);
        previewWindow.setClosable(true);
        // console.log(previewWindow.getSize())
        const storage = require('electron-json-storage');
        storage.set('app', {
            public: 1,
            executeJavaScript: `
                                if (p5.instance) { p5.instance.remove() };
                                document.querySelector("#p5").innerHTML = "";
                                ${editor.getCode().trim()};
                                new p5(null, 'p5');`,
            size: previewWindow.getSize()
        }, function(error) {
            if (error) throw error;
        });
    };
    
})();
