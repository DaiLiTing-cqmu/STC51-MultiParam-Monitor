CREATE TABLE IF NOT EXISTS sensor_real_time (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  heart_sound INT COMMENT '心音原始ADC值',
  temperature INT COMMENT '温度原始ADC值',
  light INT COMMENT '光强原始ADC值',
  voltage INT COMMENT '电压原始ADC值',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '采集时间'
);