"""
 -------------------------------------------------------------------------
 AIOpening - models/base.py
 
 Defines a simple base Model used for approximating functions.
  
 created: 2017/09/01 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

import sonnet as snt
import tensorflow as tf
import re
import os


class Model(object):
    """
    A Model is a container for one or more sonnet Modules that - put together - form a certain NN topology (a tf.Graph).
    It offers easy Module-assembly code (to assemble and re-assemble its Graph), to train the model and to predict outputs by
    running inputs through the graph (without training).
    """
    def __init__(self, name, **kwargs):
        self.name = name
        # the directory in which all information about this model is saved
        self.directory = kwargs.get("directory", re.sub("[^\\w]", "", name))  # type: str
        if self.directory[-1] != "/":  # add trailing slash to path
            self.directory += "/"
        # create our directory
        if not os.path.exists(self.directory):
            os.makedirs(self.directory)
        self.modules = kwargs.get("modules", {})
        self._feeds = kwargs.get("feeds", {})  # all input feeds (usually tf.placeholders) for this model are collected here by their tensor name
        self._outputs = {}  # the dict with all important output tensors of this model (e.g. logits, cost, predictions, train_op, accuracy, etc..)
        self._saver = None  # the tf.Saver object for the graph
        self.num_trainable_variables = 0

        self.reset()

    def add_module(self, module_):
        assert module_.name not in self.modules, "ERROR: module with name {} already in our module list!".format(module_.name)
        assert isinstance(module_, snt.AbstractModule), "ERROR: given module is not of type sonnet.AbstractModule (but of type: {})!".\
            format(type(module_).__name__)
        self.modules[module_.name] = module_

    def add_feeds(self, *feeds):
        """
        Adds placeholders (feeds) to the Module.

        :param list feeds: The list of feeds to create tf.placeholder objects from.
        Feeds are specified via a list of tuples, where each tuple has the following format:
        0=tf dtype; 1=shape (list or tuple); 2=name (without the tf ':0'-part)
        :return: A tuple containing all placeholder objects that were created in the same order as the *feeds list.
        :rtype: tuple
        """
        ret = []
        for feed in feeds:
            name = feed[2].split(":")[0]
            assert isinstance(feed, tuple) and len(feed) == 3, "ERROR: Given feed ({}) is not a tuple of 3 items (dtype, shape, name)!".format(feed)
            #assert name not in self._feeds, "ERROR: feed with name {} already in our feed list!".format(name)
            placeholder = tf.placeholder(dtype=feed[0], shape=feed[1], name=feed[2])
            self._feeds[name] = placeholder
            ret.append(placeholder)
        return tuple(ret)

    def get_feed(self, name):
        return self._feeds[name]

    def add_outputs(self, *outputs):
        for output in outputs:
            assert isinstance(output, tf.Tensor) or isinstance(output, tf.Operation),\
                "ERROR: Given output ({}) is not a tf.Tensor nor a tf.Operation object!".format(type(output).__name__)
            name = output.name.split(":")[0]
            self._outputs[name] = output

    def get_output(self, name):
        return self._outputs[name]

    def add_fork(self, from_, to_left, to_right):
        """
        Adds a fork topology to a network connecting three modules, one incoming, two outgoing ("left" and "right")
        :param from_:
        :type from_:
        :param to_left:
        :type to_left:
        :param to_right:
        :type to_right:
        :return:
        :rtype:
        """
        pass

    def add_concat(self):
        pass

    def reset(self):
        """
        Completely resets the Model (graph) to an empty graph, then rebuilds the graph (all variables' values will be wiped out)
        by calling the build method.
        """
        tf.reset_default_graph()
        # reconstruct our graph
        self.construct()
        self._saver = tf.train.Saver()

        self.count_num_trainable()

        print("Model reset and reconstructed: size={}".format(self.num_trainable_variables))

    def construct(self):
        """
        Rebuilds the tf.Graph from scratch into the tensorflow default_graph.
        This method needs to be overridden by all children of this Model class.
        """
        raise NotImplementedError

    def count_num_trainable(self):
        """
        Counts the number of trainable tf.Variables to get a rough idea of how complex this Model is

        :return: Number of trainable tf.Variables in the tf.Graph
        :rtype: int
        """
        self.num_trainable_variables = 0
        for variable in tf.trainable_variables():
            # shape is an array of tf.Dimension
            shape = variable.get_shape()
            variable_parameters = 1
            for dim in shape:
                variable_parameters *= dim.value
            self.num_trainable_variables += variable_parameters

        return self.num_trainable_variables

    @property
    def train_op(self):
        return self._train_op

    @train_op.setter
    def train_op(self, new_op):
        self._train_op = new_op

    @property
    def output(self):
        return self._output

    @output.setter
    def output(self, out):
        self._output = out

    def save_topology(self):
        """
        Saves the topology of the Model (the tf.Graph) to disk.
        """
        tf.train.export_meta_graph(filename=self.directory + "graph")

    def save_state(self, session):
        """
        Saves all variables of our graph (the tf.Graph) to disk.
        """
        self._saver.save(session, self.directory + "graph")

    # SUPERFLUOUS: use "reset" method
    #def load_topology(self):
    #    """
    #    Loads the topology of the Model (the tf.Graph) from disk.
    #    """
    #    # load topology (question: does this reset the default graph?)
    #    self._saver = tf.train.import_meta_graph(self.directory + "graph.meta")

    #    # reinstate our placeholder dict (self._feeds) from the newly loaded graph
    #    graph = tf.get_default_graph()
    #    for feed in self._feeds:
    #        self._feeds[feed] = graph.get_tensor_by_name(feed + ":0")

    def load_state(self, session):
        """
        Loads all variables of our graph (the tf.Graph) from disk.
        """
        self._saver.restore(session, self.directory + "graph")

