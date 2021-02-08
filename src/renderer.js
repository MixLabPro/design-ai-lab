// 渲染进程
const { ipcRenderer, remote } = require("electron");
const storage = require('electron-json-storage');
const md5 = require('md5');
const fs = require("fs"),
    path = require("path");
const timeago = require('timeago.js');
const Muuri = require("muuri");
const Resizer = require('resizer-cl');
const marked=require('marked');
// console.log(Marklib)

const Knowledge = require("./knowledge");
const Editor = require("./editor");
const runtime = require("./runtime");
const db = require('./db');
const Log = require('./log');
// const { read } = require("jimp");
// const ffmpeg=require('./ffmpeg');


//编辑器
let previewWindow = null,
    mainWindow = null;

//捕捉previewWindow的错误
//TODO 捕捉console.log信息
function onPreviewWindowError() {
    previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;

    setTimeout(() => {
        previewWindow.devToolsWebContents.executeJavaScript(
            `
        Array.from(document.querySelectorAll('.console-error-level .console-message-text'),ms=>ms.innerHTML);
        `, false).then((result) => {
            if (result.length === 0) return Log.add('success');
            result = Array.from(result, r => {
                let d = document.createElement('div');
                d.innerHTML = r;
                return d.innerText.split('\n');
            }).reverse();
            Array.from(result, r => Log.add(r));
        });
    }, 500);

};

// onPreviewWindowError();


const editor = new Editor(
    document.querySelector("#editor"),
    (code) => {
        previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
        let executeJavaScript = previewWindow.webContents.executeJavaScript;
        //const code=this.editor.getValue();
        //检查编辑器 写的代码 本身的错误
        //TODO 对预设库的调用，比如cv的兼容

        //是否是p5的代码
        // if(runtime.isP5Function(code)){
        let preRun = ['preload', 'setup', 'draw'];
        //preRun会不断执行
        executeJavaScript(`
                    console.clear();
                    if (p5.instance) { p5.instance.remove() };
                    if(!document.querySelector("#p5")){
                        let div=document.createElement('div');
                        div.id='p5';
                        document.body.appendChild(div);
                    };
                    document.querySelector("#p5").innerHTML = "";
                    ${code.trim()};
                    if(window.gui) {
                        document.querySelector("#gui-main").innerHTML="";
                        gui();
                    };
                    new p5(null, 'p5');
                    `, false)
            .then((result) => {
                // console.log("executeJavaScript-result")
                onPreviewWindowError();
            }).catch((err) => {
                //console.log("executeJavaScript-err")
                onPreviewWindowError();
            });
        // }

    }
);

//每次代码改变的时候，都会重新加载
// editor.onDidChangeModelContent=openPractice;


const knowledge = new Knowledge(
    document.querySelector("#readme"),
    document.querySelector("#course"));

//获得需要存储的数据
function getSaveFileContent() {
    return new Promise((resolve, reject) => {
        //截图
        //  console.log('截图');
        previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
        (remote.getGlobal("_WINS")).previewWindow.webContents.capturePage().then(img => {
            // console.log(img.toDataURL())
            let knowledgeJson = knowledge.get();

            resolve({
                poster: img.toDataURL(),
                title: knowledgeJson.title,
                knowledge: {
                    readme: knowledgeJson.readme,
                    course: knowledgeJson.course
                },
                code: editor.getCode(),
                size: previewWindow.getSize()
            })
        });
    });
}





//GUI
//界面

// console.log(Resizer)
let resizer = null;

// 布局
let grid = initGrid();

editor.onMouseUp = function() {
    console.log("onMouseUp", window.grid)
}
editor.onMouseDown = function() {
    // grid.destroy();
    // grid=initGrid(false);
    console.log("onMouseDown", window.grid)

    onPreviewWindowError();
}

function initGrid(dragEnabled = true) {
    try {
        // console.log('initGrid')
        let _grid = new Muuri('.grid', {
            dragEnabled: true,
            layoutOnInit: false
        }).on('move', function() {
            saveLayout(_grid);
        });

        let layout = window.localStorage.getItem('layout');
        if (layout) {
            loadLayout(_grid, layout);
        } else {
            _grid.layout(true);
        };

        window.addEventListener('load', () => _grid.refreshItems().layout());

        _grid.on('dragReleaseEnd', function(item) {
            console.log(item);
        });

        return _grid;
    } catch (error) {
        return null;
    }

}

function serializeLayout(grid) {
    var itemIds = grid.getItems().map(function(item) {
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
    var currentItemIds = currentItems.map(function(item) {
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

    grid.sort(newItems, { layout: 'instant' });
};



//ui
const editFile = document.querySelector("#edit-file"),
    // newFile = document.querySelector("#new-file"),
    // openFile = document.querySelector("#open-file"),
    // saveFile = document.querySelector("#save-file"),
    publicFile = document.querySelector("#public-file");
const practiceBtn = document.querySelector("#practice-btn");
const logdBtn=document.querySelector("#log-btn");

function addClickEventListener(element, fn) {
    let isClicked = false;
    if(element) element.addEventListener("click", e => {
        e.preventDefault();
        if (isClicked === true) return;
        isClicked = true;
        fn();
        setTimeout(() => {
            isClicked = false;
        }, 500);
    });
}

//打开文件
// addClickEventListener(openFile,openFileFn);
//编辑/预览 切换
addClickEventListener(editFile, editFileFn);
//新建
// addClickEventListener(newFile,newFileFn);
//保存
// addClickEventListener(saveFile,saveFileFn);
//发布
addClickEventListener(publicFile, pubilcFn);

//重载代码
// addClickEventListener(reloadBtn,openPractice);
//实时编辑代码
addClickEventListener(practiceBtn, practiceFn);

// log
addClickEventListener(logdBtn,onPreviewWindowError);

//打开文件
ipcRenderer.on("open-file", openFileFn);
//编辑/预览 切换
ipcRenderer.on("edit-file", (event, arg) => {
    // console.log(arg)
    editFileFn(arg.hardReadOnly);
});
//新建
ipcRenderer.on("new-file", newFileFn);
//保存
ipcRenderer.on("save-file", saveFileFn);
//关闭
ipcRenderer.on("close-file", closeFn);
//发布
ipcRenderer.on("public-file", pubilcFn);



//显示代码错误
ipcRenderer.on("executeJavaScript-result", (event, arg) => {
    //Log.add(arg.message);
    console.log(arg)
    onPreviewWindowError();
});

//仅显示主窗口,
//仅显示预览窗口
function showWinControl(mShow = true, pShow = true) {
    previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
    mainWindow = mainWindow || (remote.getGlobal("_WINS")).mainWindow;
    if (previewWindow && mainWindow) {
        console.log('previewWindow.isVisible()', previewWindow.isVisible(), pShow)
        if (previewWindow.isVisible() !== pShow) pShow == true ? previewWindow.show() : previewWindow.hide();
        if (mainWindow.isVisible() !== mShow) mShow === true ? mainWindow.show() : mainWindow.hide();
    };
};

//动态改变系统托盘菜单
//items=[ { label,click} ]
function changeAppIcon(items = []) {
    if (items.length == 0) return;
    let contextMenu = remote.Menu.buildFromTemplate(items);
    remote.getGlobal('_APPICON').setContextMenu(contextMenu);
};

//打开文件
function openFileFn() {
    let filePath = remote.dialog.showOpenDialogSync({
        title: "打开……",
        properties: ['openFile'],
        filters: [
            { name: 'Json', extensions: ['json'] }
        ]
    });
    if (filePath) {
        mainWindow = mainWindow || (remote.getGlobal("_WINS")).mainWindow;
        //mainWindow.webContents.reload();
        // mainWindow.webContents.once("dom-ready", () => {
        //     // 
            
        // });
        let res = fs.readFileSync(filePath[0], 'utf-8');
        res = JSON.parse(res);

        openFile(res);

        changeAppIcon([{
            label: '发布',
            click: pubilcFn
        }]);
    };
}

//编辑状态切换
function editFileFn(hardReadOnly = null) {
    let isReadOnly = knowledge.toggle(hardReadOnly);
    showWinControl(true, true);
    changeAppIcon([{
        label: '发布',
        click: pubilcFn
    }]);
    if (!isReadOnly) {
        // openPractice();
        // console.log(grid)
        //编辑状态
        editFile.innerHTML = `<i class="far fa-lightbulb"></i>`;
        // document.getElementById("knowledge-pannel").classList.remove("knowledge-pannel-small");
        document.getElementById("knowledge-pannel").classList.add("pannel-large");
        if(grid) grid.destroy();
    } else {
        //预览状态
        console.log("预览状态")
        editFile.innerHTML = `<i class="far fa-eye"></i>`;
        document.getElementById("knowledge-pannel").classList.remove("pannel-large");
        grid = initGrid();
    };
};

//新建文件
function newFileFn() {
    document.querySelector(".grid").style.display = "block";
    document.getElementById("blank-pannel").style.display = "none";
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
    // localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
    //localStorage.setItem("code", editor.getCode());
    localStorage.removeItem('layout');
    grid.destroy();
    grid = initGrid();

    showWinControl(true, false);
    changeAppIcon([{
        label: '保存',
        click: saveFileFn
    }]);
}

function saveFileFn() {
    // localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
    //localStorage.setItem("code", editor.getCode());

    getSaveFileContent().then(res => {
        let filePath = remote.dialog.showSaveDialogSync({
            title: "另存为……",
            defaultPath: res.title.trim() + `.json`
        });
        if (filePath) {
            res.title = path.basename;
            fs.writeFile(filePath, JSON.stringify(res, null, 2), 'utf8', function(err) {
                if (err) console.error(err);
                console.log("保存成功");
                knowledge.toggle(true);
                remote.dialog.showMessageBox({
                    type: 'info',
                    message: '保存成功',
                    buttons: ['好的']
                });

                changeAppIcon([{
                    label: '发布',
                    click: pubilcFn
                }]);

            });
        };

    });
    // console.log(filePath)
};



function closeFn() {
    //TODO 确定关闭？未保存将丢失

    // console.log('closeFn')
    practiceFn(true);
    
    document.querySelector(".grid").style.display = "none";
    document.getElementById("blank-pannel").style.display = "block";

    previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
    mainWindow = mainWindow || (remote.getGlobal("_WINS")).mainWindow;
    if (previewWindow && mainWindow) {
        previewWindow.hide();
        mainWindow.show();
    };

    let div = document.createDocumentFragment();
    Array.from(db.getAll(), d => {
        div.appendChild(createCard(d));
    });
    document.getElementById("recent-files").innerHTML = '';
    document.getElementById("recent-files").appendChild(div);

    showWinControl(true, false);

    changeAppIcon([{
        label: '新建',
        click: newFileFn
    }]);

}

function openFile(res) {
    // console.log("openFile",res)
    knowledge.set(res.knowledge);
    editor.setCode(res.code);
    //预览窗口的尺寸更新
    previewWindow = previewWindow || (remote.getGlobal("_WINS")).previewWindow;
    // res.size
    if(res.size)previewWindow.setSize(...res.size);
    // localStorage.setItem("knowledge", JSON.stringify(knowledge.get()));
    //localStorage.setItem("code", editor.getCode());
    localStorage.removeItem('layout');

    //存至数据库
    db.add(res);

    document.querySelector(".grid").style.display = "block";
    document.getElementById("blank-pannel").style.display = "none";

    if(grid) grid.destroy();
    grid = initGrid();

    practiceFn(true);
}

function createCard(data) {
    let div = document.createElement('div');
    div.className = "card";

    let card = document.createElement('div');
    card.className = "card-body";

    let img = document.createElement('div');
    img.className = "img"
    img.style.backgroundImage = `url(${data.poster})`

    let content = document.createElement('div');
    content.className = "content";

    let readme = document.createElement('h5');
    readme.innerHTML = marked(data.knowledge.readme);
    readme.innerText=readme.innerText;

    let t = document.createElement('p');
    t.innerHTML = timeago.format(data.createDate, 'zh_CN');

    div.appendChild(card);
    card.appendChild(img);
    card.appendChild(content);
    content.appendChild(readme);
    content.appendChild(t);
    // console.log(data)
    addClickEventListener(div, () => openFile(data));
    return div;
}

function practiceFn(readOnly=null) {
    let t = editor.toggle(readOnly);
    if (t === true) {
        closePracticeHtml();
    } else {
        //编程模式
        if(grid) grid.destroy();
        openPracticeFn();
    };
};

//编程，UI状态关闭
function closePracticeHtml() {
    document.getElementById("knowledge-pannel").style.display="block";
    document.getElementById("editor-pannel").classList.remove("pannel-large");
    document.getElementById("log").style.display = "none";
    document.body.querySelector('#frame').style.borderWidth = '0px !important;'
    if(grid) grid.destroy();
    grid = initGrid();
    practiceBtn.innerHTML = `<i class="fas fa-sync"></i>`;
    editor.execute();
    //localStorage.setItem("code", editor.getCode());
    editor.format();
}

//编程，UI状态
function openPracticeHtml() {
    document.getElementById("knowledge-pannel").style.display="none";
    document.getElementById("editor-pannel").classList.add("pannel-large");
    document.getElementById("log").style.display = "block";
    // document.getElementById("editor-container").style.height="80%";
    practiceBtn.innerHTML = `<i class="fas fa-sync fa-spin"></i>`;
    if (resizer) return document.body.querySelector('#frame').style.borderWidth = '12px';
    resizer = new Resizer('#frame', {
        grabSize: 10,
        resize: 'vertical',
        handle: 'bar'
    });
}

//编程功能，按钮
function openPracticeFn() {
    openPracticeHtml();
    openPractice(true, true);
};
//打开编程功能
function openPractice(mShow = true, pShow = true) {
    showWinControl(mShow, pShow);
    if (previewWindow && mainWindow) {
        mainWindow.focus();
        previewWindow.webContents.reload();
        previewWindow.webContents.once('dom-ready', () => {
            editor.execute();
            //localStorage.setItem("code", editor.getCode());
            editor.format();
            // pShow===true?previewWindow.show():previewWindow.hide();
            previewWindow.setResizable(true);
            previewWindow.setClosable(true);
        });
    };
};

//保存窗口状态
// 0 主窗口 1 主窗口 预览窗口 2 预览窗口
function saveWindowsStatus(status = 0) {
    let obj = {
        status: status,
        size: previewWindow.getSize(),
        mainWindow: {
            show: mainWindow.isVisible(),
            bound: mainWindow.getBounds()
        }
    };

    if (status === 2) obj.executeJavaScript = `
                    if (p5.instance) { p5.instance.remove() };
                    document.querySelector("#p5").innerHTML = "";
                    ${editor.getCode().trim()};
                    new p5(null, 'p5');`;

    storage.set('app', obj, function(error) {
        if (error) throw error;
    });
}

//发布按钮
function pubilcFn() {
    editor.toggle(false);
    showWinControl(false, true);
    previewWindow.setResizable(false);
    previewWindow.setClosable(true);
    openPractice(false, true);

    saveWindowsStatus(2);
    changeAppIcon([{
        label: '编辑',
        click: () => {
            editFileFn(true);
        }
    }]);
};