#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一日志管理系统
支持日志轮转、分级输出、历史记录
"""

import json
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from logging.handlers import RotatingFileHandler

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
LOG_DIR = PROJECT_ROOT / '.cache' / 'logs'
HISTORY_FILE = PROJECT_ROOT / '.cache' / 'execution_history.json'

# 确保日志目录存在
LOG_DIR.mkdir(parents=True, exist_ok=True)


class XLLuckyLogger:
    """统一日志管理器"""
    
    _instance = None
    _loggers = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._setup_main_logger()
    
    def _setup_main_logger(self):
        """设置主日志器"""
        self.main_logger = logging.getLogger('xllucky')
        self.main_logger.setLevel(logging.DEBUG)
        
        # 清除已有处理器
        self.main_logger.handlers.clear()
        
        # 文件处理器（带轮转）
        # 最大 5MB，保留 5 个备份
        file_handler = RotatingFileHandler(
            LOG_DIR / 'xllucky.log',
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        self.main_logger.addHandler(file_handler)
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter('%(message)s')
        console_handler.setFormatter(console_formatter)
        self.main_logger.addHandler(console_handler)
    
    def get_logger(self, name: str) -> logging.Logger:
        """获取子日志器"""
        if name not in self._loggers:
            logger = logging.getLogger(f'xllucky.{name}')
            
            # 为每个模块创建独立日志文件
            module_handler = RotatingFileHandler(
                LOG_DIR / f'{name}.log',
                maxBytes=2 * 1024 * 1024,
                backupCount=3,
                encoding='utf-8'
            )
            module_handler.setLevel(logging.DEBUG)
            module_handler.setFormatter(logging.Formatter(
                '%(asctime)s | %(levelname)-8s | %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            ))
            logger.addHandler(module_handler)
            
            self._loggers[name] = logger
        
        return self._loggers[name]
    
    @property
    def logger(self):
        return self.main_logger


class ExecutionHistory:
    """执行历史记录管理"""
    
    def __init__(self):
        self.history_file = HISTORY_FILE
        self._ensure_file()
    
    def _ensure_file(self):
        """确保历史文件存在"""
        if not self.history_file.exists():
            self.history_file.parent.mkdir(parents=True, exist_ok=True)
            self._save({'records': [], 'stats': {}})
    
    def _load(self) -> dict:
        """加载历史数据"""
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {'records': [], 'stats': {}}
    
    def _save(self, data: dict):
        """保存历史数据"""
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def record_execution(self, 
                         success: int, 
                         unchanged: int, 
                         failed: int, 
                         duration: int,
                         trigger: str = 'manual',
                         details: dict = None):
        """记录一次执行"""
        data = self._load()
        
        record = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'success': success,
            'unchanged': unchanged,
            'failed': failed,
            'duration': duration,
            'trigger': trigger,  # manual / schedule / force
            'details': details or {}
        }
        
        data['records'].append(record)
        
        # 只保留最近 100 条记录
        if len(data['records']) > 100:
            data['records'] = data['records'][-100:]
        
        # 更新统计
        self._update_stats(data)
        
        self._save(data)
    
    def _update_stats(self, data: dict):
        """更新统计数据"""
        records = data['records']
        if not records:
            data['stats'] = {}
            return
        
        total = len(records)
        success_count = sum(1 for r in records if r['failed'] == 0)
        total_duration = sum(r['duration'] for r in records)
        
        # 最近7天统计
        week_ago = datetime.now() - timedelta(days=7)
        recent_records = [
            r for r in records 
            if datetime.strptime(r['timestamp'], '%Y-%m-%d %H:%M:%S') > week_ago
        ]
        
        data['stats'] = {
            'total_executions': total,
            'success_rate': round(success_count / total * 100, 1) if total > 0 else 0,
            'avg_duration': round(total_duration / total, 1) if total > 0 else 0,
            'last_execution': records[-1]['timestamp'] if records else None,
            'recent_7d': {
                'count': len(recent_records),
                'success_rate': round(
                    sum(1 for r in recent_records if r['failed'] == 0) / len(recent_records) * 100, 1
                ) if recent_records else 0
            }
        }
    
    def get_stats(self) -> dict:
        """获取统计数据"""
        data = self._load()
        return data.get('stats', {})
    
    def get_recent_records(self, count: int = 10) -> list:
        """获取最近的执行记录"""
        data = self._load()
        return data.get('records', [])[-count:]
    
    def get_summary(self) -> str:
        """获取摘要文本"""
        stats = self.get_stats()
        if not stats:
            return "暂无执行记录"
        
        lines = [
            f"📊 执行统计",
            f"  总执行次数: {stats.get('total_executions', 0)}",
            f"  成功率: {stats.get('success_rate', 0)}%",
            f"  平均耗时: {stats.get('avg_duration', 0)}秒",
            f"  最近执行: {stats.get('last_execution', 'N/A')}",
        ]
        
        recent = stats.get('recent_7d', {})
        if recent:
            lines.append(f"  近7天: {recent.get('count', 0)}次, 成功率 {recent.get('success_rate', 0)}%")
        
        return '\n'.join(lines)


def get_logger(name: str = None) -> logging.Logger:
    """获取日志器的便捷函数"""
    manager = XLLuckyLogger()
    if name:
        return manager.get_logger(name)
    return manager.logger


def record_execution(success: int, unchanged: int, failed: int, duration: int, 
                     trigger: str = 'manual', details: dict = None):
    """记录执行的便捷函数"""
    history = ExecutionHistory()
    history.record_execution(success, unchanged, failed, duration, trigger, details)


def get_execution_stats() -> dict:
    """获取执行统计的便捷函数"""
    history = ExecutionHistory()
    return history.get_stats()


def get_execution_summary() -> str:
    """获取执行摘要的便捷函数"""
    history = ExecutionHistory()
    return history.get_summary()


def get_recent_executions(count: int = 10) -> list:
    """获取最近执行记录的便捷函数"""
    history = ExecutionHistory()
    return history.get_recent_records(count)


if __name__ == '__main__':
    # 测试
    logger = get_logger()
    logger.info("日志系统初始化成功")
    
    module_logger = get_logger('test')
    module_logger.info("模块日志测试")
    
    # 测试执行记录
    record_execution(3, 2, 0, 15, 'manual')
    print(get_execution_summary())
