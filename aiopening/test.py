"""
 -------------------------------------------------------------------------
 AIOpening - 
 test
 
 !!TODO: add file description here!! 
  
 created: 2017/08/31 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

import sonnet as snt
import numpy as np
import tensorflow as tf

linear_regression_module = snt.Linear(output_size=1)
train_data = tf.constant([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], [7.0, 8.0, 9.0]])

train_predictions = linear_regression_module(train_data)
#with tf.Session() as sess:
print(train_predictions)

