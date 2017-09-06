"""
 -------------------------------------------------------------------------
 AIOpening - misc/helper.py
 
 Some helper functions.
  
 created: 2017/09/05 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""


def list_of_lists(input_, len_, default):
    """
    Processes a list (or tuple), in which the default item is a list (or tuple) as well, specified by default.
    E.g.:
    input = ((1, 2), (3, 4)), len=2, default=None -> everything ok -> return as is
    input = [5, 7], len=1, default=(5, 5) -> input is not a list of lists -> return: ([5, 7])
    input = [5, 7], len=2, default=(5, 5) -> input is not a list of lists and too short for len -> return ([5,7], (5,5) <-- pad rest of len with default)
    input = None, len=4, default=(5, 5) -> input is None -> return all defaults: ((5, 5), (5, 5), (5, 5), (5, 5))

    :param input_:
    :param len_:
    :param default:
    :return:
    :rtype:
    """
    if input_ is None:
        input_ = default
        assert isinstance(default, list) or isinstance(default, tuple), "ERROR: default is not list or tuple!"
    assert isinstance(input_, list) or isinstance(input_, tuple), "ERROR: input_ is not list or tuple!"
    first_el = input_[0]

    # we have only single item -> fill up with default or with first_el (if default None)
    if not (isinstance(first_el, list) or isinstance(first_el, tuple)):
        assert default is None or len(input_) == len(default), "ERROR: default value ({}) does not match input_ ({})".format(default, input_)
        ret = [input_]
        for i in range(1, len_):
            ret.append(default if default is not None else input_)

    # we have a list of lists -> fill up until len_ with default (if not None) or last-valid value (if default == None)
    else:
        ret = []
        for i in range(len_):
            ret.append(input_[i] if len(input_) > i else default if default is not None else input_[-1])

    return tuple(ret)

