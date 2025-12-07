package com.escodro.wordflow.di

import com.escodro.navigationapi.provider.NavGraph
import com.escodro.wordflow.navigation.WordFlowNavGraph
import org.koin.core.module.Module
import org.koin.core.module.dsl.factoryOf
import org.koin.dsl.bind
import org.koin.dsl.module

/**
 * WordFlow dependency injection module.
 */
val wordFlowModule = module {
    // Navigation
    factoryOf(::WordFlowNavGraph) bind NavGraph::class
}

