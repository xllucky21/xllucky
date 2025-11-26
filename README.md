# Python项目

这是一个基础的Python项目结构，可以运行Python文件。

## 项目结构

```
├── main.py              # 主程序入口
├── src/                 # 源代码目录
│   ├── __init__.py     # 包初始化文件
│   ├── calculator.py   # 示例计算器模块
│   └── utils.py        # 工具函数模块
├── tests/               # 测试文件目录
│   ├── __init__.py
│   └── test_calculator.py
├── requirements.txt     # 项目依赖包列表
├── run.py              # 运行脚本
└── README.md           # 项目说明文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行主程序

```bash
python main.py
```

或者使用运行脚本：

```bash
python run.py
```

### 3. 运行测试

```bash
python -m pytest tests/
```

## 功能说明

- `main.py`: 项目主入口，演示基本功能
- `src/calculator.py`: 简单的计算器类
- `src/utils.py`: 常用工具函数
- `run.py`: 项目运行脚本，可以指定要运行的Python文件

## 使用方法

### 运行特定的Python文件

```bash
# 运行主程序
python run.py main.py

# 运行计算器示例
python run.py src/calculator.py

# 直接运行任何Python文件
python run.py path/to/your/file.py
```

### 开发新功能

1. 在 `src/` 目录下创建新的Python模块
2. 在 `main.py` 中导入并使用新模块
3. 在 `tests/` 目录下添加对应的测试文件

## 注意事项

- 确保Python版本为3.7或更高
- 建议使用虚拟环境进行开发
- 运行前请安装所需的依赖包