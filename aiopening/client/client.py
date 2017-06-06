"""
 -------------------------------------------------------------------------
 AIOpener - 
 client
 
 command line client for aiopener-server operations
 - allows login, start/list projects
 - submission of games for solving
 - check job status
  
 created: 2017/06/05 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

from websocket import create_connection
import argparse
import json

"""
# login -> this will login the user into the server

# new -> this will create a new project in the current directory (hidden config file)
ai new "new project"

"""
parser = argparse.ArgumentParser(description='aiopening command line client (for submitting MDP-solver jobs to the aiopening server)')
parser.add_argument("cmd", choices=["new"], help="the command to be executed on the server")
parser.add_argument("options", metavar="opt", nargs="+", help="the options for the chosen command")

# read command line args
args = parser.parse_args()

# connecting to server
ws = create_connection("ws://localhost:2017")

# new project
if args.cmd == "new":
    project_name = args.options[0]
    ws.send(json.dumps({"request": "new project", "projectName": project_name}))
    # wait for response
    result = ws.recv()
    print("Received '{}'".format(result))
    # need to store project in local hidden file (the directory will represent the project)
    ws.close()

