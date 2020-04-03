const fs = require('fs')
const image = require('imageinfo')
const { createCanvas, loadImage } = require('canvas')
const program = require('commander')
const color = require('colors-cli')
const prompt = require('prompt')

const schema = [
  {
    name: "path",
    description: '输入原图目录',   
    type: 'string',              
    message: '图片目录不能为空', 
    default: '',           
    required: true
  },
  {
    name: "name",
    description: '输入合成图命名',   
    type: 'string',              
    default: '合成图片',           
    required: false
  }
]
prompt.get(schema, function (err, result) {
  if(err) {
    console.log(color.red(err))
    return
  }
  const IMG_PATH = result.path + '/'
  const IMG_TEMP_PATH = IMG_PATH + 'tempMultiGraphFolder/'
  const IMG_NAME = result.name
  
  const filesMain = {
    // 读取文件夹下的所有文件，返回文件路径数组
    async readFileList(path) {
      const files = fs.readdirSync(path); // 读取图片文件夹下文件列表
  
      if (fs.existsSync(IMG_TEMP_PATH)) {
        this.rmNotEmptyFolder(IMG_TEMP_PATH) // 如果已存在临时文件夹则删除掉
      }
      fs.mkdirSync(IMG_TEMP_PATH)
      files.forEach(async (filename, index) => {
        const _file = path + filename
        const stats = fs.statSync(_file);
  
        if (!stats.isDirectory()) {
          // 非文件夹类型
          const originBuffer = fs.readFileSync(_file)
          if (Buffer.isBuffer(originBuffer)) {
            const reg = /(\d+)/ig
            reg.test(filename)
            const newFileName = RegExp.$1
            // 复制并重命名
            fs.writeFileSync(IMG_TEMP_PATH + newFileName + '.' + filename.split('.')[1], originBuffer)
          }
        }
      })
  
      const tempFiles = fs.readdirSync(IMG_TEMP_PATH)
      // 提取图片命名序号进行排序
      const _tempFiles = tempFiles.map(item => {
        const reg = /(\d+)/ig
        reg.test(item)
        return RegExp.$1 + '.' + item.split('.')[1]
      }).sort(function (a, b) {
        return a.split('.')[0] - b.split('.')[0]
      })
      let _filesList = []
      _tempFiles.forEach(function (_filename, index) {
        _filesList.push({
          path: IMG_TEMP_PATH,
          filename: _filename
        })
      })
      return _filesList
    },
    // 获取文件夹下的所有图片
    async getImageFiles(path) {
      let imageList = [];
      const fileList = await this.readFileList(path)
      fileList.forEach((item) => {
        const ms = image(fs.readFileSync(item.path + item.filename));
        ms.mimeType && (imageList.push({
          file: item.path + item.filename,
          width: ms.width,
          height: ms.height
        }))
      });
      return imageList;
    },
    // 删除非空文件夹
    rmNotEmptyFolder(path) {
      if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
          var curPath = path + "/" + file;
          if (fs.statSync(curPath).isDirectory()) { // recurse
            rmNotEmptyFolder(curPath);
          } else { // delete file
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    }
  }
  
  const canvasMain = {
    async create() {
      //获取文件夹下的所有图片
      const list = await filesMain.getImageFiles(IMG_PATH);
      console.log(color.cyan('正在合成...'))

      const width = list[0].width
      const height = list[0].height
      let cHeight = 0
      list.forEach(item => {
        const _height = item.height*width/item.width
        cHeight+=_height
      })

      const canvas = createCanvas(width, cHeight)
      const ctx = canvas.getContext('2d')
      
      let curHeight = 0
      for (let i = 0; i < list.length; i++) {
        const img = await loadImage(list[i].file)
        const _height = list[i].height*width/list[i].width
        ctx.drawImage(img, 0, curHeight, width, _height)
        curHeight+=_height
      }
  
      const out = fs.createWriteStream(`${IMG_PATH}/${IMG_NAME}.png`)
      const stream = canvas.createPNGStream()
      stream.pipe(out)
      out.on('finish', () => {
        filesMain.rmNotEmptyFolder(IMG_TEMP_PATH) // 移除掉临时存放图片的文件夹
        console.log(color.green('合成成功'))
      })
    }
  }
  
  canvasMain.create()
});
