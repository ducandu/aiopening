"""
 -------------------------------------------------------------------------
 AIOpening - algorithms/a3c.py
 
 Implementation of the A3C (Asynchronous Advantage Actor Critic)
 algorithm [1]

 created: 2017/09/01 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------

[1] Mnih et al.: Asynchronous Methods for Deep Reinforcement Learning (Jun 2016)

"""

import aiopening as ai


class A3C(ai.algorithms.Algorithm):
    """
    Implementation of deepmind's A3C algo [1]
    """
    def __init__(self, name, **kwargs):
        super().__init__(name)

    def run_atomic(self):
        """
        A single pass through the A3C
        :return:
        :rtype:
        """
        pass
