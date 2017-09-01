"""
 -------------------------------------------------------------------------
 AIOpening - grid_world_vpg
 
 An example of a parallelized policy gradient method (A3C) run on a simple
 grid world MDP
  
 created: 2017/08/31 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

from aiopening.envs.grid_world import GridWorld
#from aiopening.modules.feed_forward_nn import MLP

env = GridWorld("8x8")

#model =