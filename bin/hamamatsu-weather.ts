#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { HamamatsuWeatherStack, Context as WeatherContext } from '../lib/hamamatsu-weather-stack'
import { HamamatsuPifaaStack, Context as PifaaContext } from '../lib/hamamatsu-pifaa-stack'

const app = new cdk.App()

const stages = ['dev', 'stg', 'prd']
stages.forEach(stage => {
  const context = app.node.tryGetContext(stage)

  const weatherContext: WeatherContext = context.weatherStack
  new HamamatsuWeatherStack(app, weatherContext.stackName, { context: weatherContext })

  const pifaaContext: PifaaContext = context.pifaaStack
  new HamamatsuPifaaStack(app, pifaaContext.stackName, { context: pifaaContext })
})
