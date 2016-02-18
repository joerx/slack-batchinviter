'use strict'

let fs = require('fs')
let request = require('request')
let assert = require('assert')
let format = require('util').format

// validate
assert(process.env.SLACK_API_TOKEN, 'SLACK_API_TOKEN is missing')
assert(process.argv.length > 2, 'Param channel name is missing')

const SLACK_API_TOKEN = process.env.SLACK_API_TOKEN
const INVITEE_LIST = './invitees.txt'
const CHANNEL_NAME = process.argv[2]

fs.accessSync(INVITEE_LIST, fs.R_OK) // make sure we can read this

let agent = request.defaults({
  json: true,
  baseUrl: 'https://slack.com/api'
})

// fetch registered users from slack
function fetchSlackUsers() {
  return new Promise((resolve, reject) => {
    let url = '/users.list?token=' + SLACK_API_TOKEN
    agent.get(url, (err, response) => {
      if (err) reject(err)
      else resolve(response.body.members)
    })
  })
}

// load speaker list from file, remove duplicates
function loadInviteeList() {
  return new Promise((resolve, reject) => {
    fs.readFile(INVITEE_LIST, (err, data) => {
      if (err) reject(err)
      else {
        let emails = data.toString('utf-8').split('\n')
        emails = emails.filter((entry, i) => emails.indexOf(entry) === i)
        resolve(emails)
      }
    })
  })
}

// finds a group by name (groups are private channels)
function findGroupByName(groupName) {
  return new Promise((resolve, reject) => {
    agent.get('/groups.list?token=' + SLACK_API_TOKEN, (err, response) => {
      if (err) reject(err)
      else {
        let grp = response.body.groups.filter(grp => grp.name === groupName)
        resolve(grp.length > 0 ? grp[0] : null)
      }
    })
  })
}

// invite a user to a group
function inviteUserToGroup(user, group) {
  return new Promise((resolve, reject) => {
    let url = format('/groups.invite?token=%s&channel=%s&user=%s', SLACK_API_TOKEN, group.id, user.id)
    agent.get(url, (err, response) => {
      if (err) reject(err)
      else {
        resolve({
          name: user.name,
          email: user.email,
          userId: user.id,
          isOk: response.body.ok,
          alreadyInGroup: response.body.already_in_group, 
          status: response.body.ok ? 'ok' : 'not ok',
          error: response.body.error
        })  
      }
    })
  })
}

Promise.all([
  fetchSlackUsers(), 
  loadInviteeList(), 
  findGroupByName(CHANNEL_NAME)
])
.then(args => {

  let slackUsers = args[0]
  let invitees = args[1]
  let group = args[2]

  assert(group, 'Group not found')

  console.log('%s slack users, %s invitees', slackUsers.length, invitees.length)
  console.log('found group \'%s\' with id %s', group.name, group.id)

  let inviteesInSlack = slackUsers
    .filter(user => invitees.indexOf(user.profile.email) >= 0)
    .map(user => ({email: user.profile.email, id: user.id, name: user.name}))

  console.log('%s invitees in slack', inviteesInSlack.length)

  let promises = inviteesInSlack.map(sp => inviteUserToGroup(sp, group))
  return Promise.all(promises)
})
.then(results => {
  let stats = results.map(res => [
    res.name,
    res.email,
    res.userId,
    res.status,
    res.alreadyInGroup ? 'y' : 'n',
    res.error || ''
  ].join(','))
  console.log('name,email,user_id,status,already_in_group,error')
  console.log(stats.join('\n'))
})
.catch(console.error)
