#!/bin/bash
apt-get update
apt-get install -y mysql-server
service mysql start
mysql < setup.sql