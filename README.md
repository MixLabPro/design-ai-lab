![DEMO](https://shadowcz007.github.io/design-ai-lab/examples/demo.png)

# design-ai-lab

智能设计实验工具 Artificial Intelligence for Graph Design

- 使用JavaScript易于上手
- 集成p5.js、ml4.js、tensorflow.js
- 提供示例代码
- 桌面软件，安装即用


**Clone and run for a quick way to see Electron in action.**

基本的electron应用包括以下文件:

- `package.json` - 管理应用的入口，依赖包等.
- `main.js` - 应用的主进程 **main process**.
- `src/index.html` - 一个html网页，是应用的渲染进程 **renderer process**.

可查阅electron官方文档 [Quick Start Guide](https://electronjs.org/docs/tutorial/quick-start).

## 如何使用

通过git clone此仓库，然后通过npm来进行安装、开发:

```bash
# Clone this repository
git clone https://github.com/shadowcz007/design-ai-lab.git
# Go into the repository
cd design-ai-lab
# Install dependencies
npm install
# Run the app
npm start
```

## AI功能

在main.js中开启AI功能：

```javascript
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
```