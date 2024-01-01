#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { HamamatsuWeatherStack, Context } from '../lib/hamamatsu-weather-stack'

const app = new cdk.App()

const stages = ['dev', 'stg', 'prd']
stages.forEach(stage => {
  const context: Context = app.node.tryGetContext(stage)
  new HamamatsuWeatherStack(app, context.stackName, { context })
})
