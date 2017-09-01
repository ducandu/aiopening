"""
 -------------------------------------------------------------------------
 AIOpening - 
 mlp
 
 !!TODO: add file description here!! 
  
 created: 2017/08/31 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

import sonnet as snt
# import tensorflow as tf
# import gym.spaces


class FeedForwardModule(snt.AbstractModule):
    """
    A multi-layer perceptron (simple feed forward neural net with n hidden layers with [m, o, p, ...] hidden nodes each).
    The number of input and output nodes can be determined by the optional observation (input) and action (output) spaces
    """

    def __init__(self, name, hidden_nodes=(32,), **kwargs):
        obs = kwargs.get("observation_space")
        self._input_nodes = obs.flat_dim if obs else kwargs.get("input_nodes", None)
        assert self.input_nodes, "***ERROR: input_nodes not given!"
        self._hidden_nodes = hidden_nodes
        self._hidden_activations = kwargs.get("hidden_activations", None)
        act = kwargs.get("action_space")
        self._output_nodes = act.flat_dim if act else kwargs.get("output_nodes", None)

        # generate the model in tensorflow
        self.name = name
        super().__init__(name=name)

    def _build(self, inputs):
        x_to_h = snt.Linear(output_size=self._hidden_nodes)


