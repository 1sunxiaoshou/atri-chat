"""ASR配置加密工具"""
import os
import base64
from cryptography.fernet import Fernet
from typing import Optional


class ConfigCrypto:
    """配置加密/解密工具"""
    
    def __init__(self, key: Optional[str] = None):
        """初始化
        
        Args:
            key: 加密密钥（Base64编码），不提供则从环境变量读取或生成
        """
        if key:
            self._key = key.encode() if isinstance(key, str) else key
        else:
            # 从环境变量读取或生成新密钥
            key_str = os.getenv("ASR_CONFIG_KEY")
            if not key_str:
                # 生成新密钥并警告
                self._key = Fernet.generate_key()
                print(f"⚠️  未设置ASR_CONFIG_KEY环境变量，已生成临时密钥: {self._key.decode()}")
                print("   请将此密钥保存到.env文件中，否则重启后无法解密配置！")
            else:
                # 移除可能的空格
                key_str = key_str.strip()
                self._key = key_str.encode() if isinstance(key_str, str) else key_str
        
        self._fernet = Fernet(self._key)
    
    def encrypt(self, data: str) -> str:
        """加密配置数据
        
        Args:
            data: 明文配置（JSON字符串）
            
        Returns:
            加密后的Base64字符串
        """
        encrypted = self._fernet.encrypt(data.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """解密配置数据
        
        Args:
            encrypted_data: 加密的Base64字符串
            
        Returns:
            解密后的明文配置（JSON字符串）
        """
        decrypted = self._fernet.decrypt(encrypted_data.encode())
        return decrypted.decode()
    
    @staticmethod
    def generate_key() -> str:
        """生成新的加密密钥
        
        Returns:
            Base64编码的密钥字符串
        """
        return Fernet.generate_key().decode()
