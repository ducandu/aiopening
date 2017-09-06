"""
 -------------------------------------------------------------------------
 AIOpening - modules/__init__.py

 Neural Net Modules constructed with deepmind/sonnet

 created: 2017/08/31 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

from .fully_connected_nn import FullyConnectedNN
from .convolutional_2d_nn import Convolutional2DNN
from .flatten_layer import FlattenLayer

__all__ = ["FullyConnectedNN", "Convolutional2DNN", "FlattenLayer"]

